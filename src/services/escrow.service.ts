import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { EscrowError, mapPostgresError } from '@/lib/escrow/errors';
import type { OrderStatus } from '@/lib/escrow/state-machine';
import { kaspiWebhookSchema, toMinorUnits, type KaspiWebhookPayload } from '@/lib/kaspi/webhook.schema';
import { verifyKaspiSignature } from '@/lib/kaspi/signature';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

type DbClient = SupabaseClient<Database>;

export interface EscrowRpcResult {
  ok: boolean;
  idempotent: boolean;
  orderId: string;
  status: OrderStatus | null;
  version: number | null;
  transactionId?: string | null;
  reason?: string;
  error?: string;
}

interface RawRpcResult {
  ok?: boolean;
  idempotent?: boolean;
  order_id?: string;
  status?: OrderStatus;
  version?: number;
  transaction_id?: string | null;
  reason?: string;
  error?: string;
  auto_complete_at?: string | null;
}

function normalize(raw: unknown, fallbackOrderId: string): EscrowRpcResult {
  const value = (raw ?? {}) as RawRpcResult;
  return {
    ok: value.ok ?? false,
    idempotent: value.idempotent ?? false,
    orderId: value.order_id ?? fallbackOrderId,
    status: value.status ?? null,
    version: value.version ?? null,
    transactionId: value.transaction_id ?? null,
    reason: value.reason,
    error: value.error,
  };
}

/**
 * Сервисный слой escrow.
 *
 * Все мутации выполняются через SECURITY DEFINER RPC, которые внутри одной
 * транзакции берут `SELECT ... FOR UPDATE` на строку заказа и проверяют
 * оптимистическую версию. Гонки (двойное подтверждение, отмена во время
 * спора, повторная доставка вебхука) отсекаются на уровне БД, а не приложения.
 */
export class EscrowService {
  constructor(private readonly db: DbClient) {}

  static withServiceRole(): EscrowService {
    return new EscrowService(createAdminClient());
  }

  static async withUserSession(): Promise<EscrowService> {
    return new EscrowService(await createUserClient());
  }

  // ---------------------------------------------------------------------
  // Kaspi QR webhook
  // ---------------------------------------------------------------------

  /**
   * Обработка вебхука Kaspi: подпись -> схема -> идемпотентный захват средств.
   *
   * Идемпотентность обеспечивается тремя уровнями:
   *   1) UNIQUE(provider, event_id) в public.payment_webhooks;
   *   2) проверка текущего статуса заказа под блокировкой строки;
   *   3) UNIQUE(idempotency_key) и частичный UNIQUE(order_id) в transactions.
   *
   * Повторная доставка одного и того же события ВСЕГДА возвращает ok=true,
   * чтобы Kaspi не уходил в бесконечные ретраи.
   */
  async handleKaspiWebhook(rawBody: string, signatureHeader: string | null): Promise<EscrowRpcResult> {
    verifyKaspiSignature(rawBody, signatureHeader, process.env.KASPI_WEBHOOK_SECRET ?? '');

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new EscrowError('PAYLOAD_INVALID', 'тело вебхука не является JSON');
    }

    const parsed = kaspiWebhookSchema.safeParse(json);
    if (!parsed.success) {
      throw new EscrowError('PAYLOAD_INVALID', 'схема вебхука не совпадает', {
        issues: parsed.error.issues.map(
          (issue: { path: Array<string | number>; message: string }) =>
            `${issue.path.join('.')}: ${issue.message}`,
        ),
      });
    }

    const payload: KaspiWebhookPayload = parsed.data;

    // Неуспешные события не двигают деньги: фиксируем и выходим.
    if (payload.eventType !== 'payment.completed') {
      return {
        ok: true,
        idempotent: true,
        orderId: payload.orderId,
        status: null,
        version: null,
        reason: `IGNORED_EVENT_${payload.eventType}`,
      };
    }

    const { data, error } = await this.db.rpc('kaspi_webhook_capture', {
      p_event_id: payload.eventId,
      p_event_type: payload.eventType,
      p_order_id: payload.orderId,
      p_payment_id: payload.paymentId,
      p_amount_minor: toMinorUnits(payload.amount),
      p_raw: payload as unknown as Record<string, unknown>,
      p_signature: signatureHeader,
    });

    if (error) {
      throw mapPostgresError(error, { orderId: payload.orderId, eventId: payload.eventId });
    }

    const result = normalize(data, payload.orderId);

    if (!result.ok && result.error === 'AMOUNT_MISMATCH') {
      // Событие сохранено со статусом REJECTED — ретраить бессмысленно.
      throw new EscrowError('AMOUNT_MISMATCH', 'сумма платежа не совпадает с заказом', {
        orderId: payload.orderId,
        eventId: payload.eventId,
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------
  // Действия участников сделки
  // ---------------------------------------------------------------------

  /**
   * Подтверждение сделки покупателем: ESCROW_HOLD|VERIFYING -> COMPLETED.
   *
   * Защита от гонок:
   *   * строка заказа блокируется FOR UPDATE внутри RPC;
   *   * expectedVersion реализует оптимистичную блокировку (ESC02);
   *   * статус DISPUTE отсекается до перехода (ESC01) — «вывести» деньги
   *     во время спора невозможно даже при параллельных запросах;
   *   * повторный вызов идемпотентен, второй PAYOUT блокируется UNIQUE-индексом.
   */
  async confirmOrderByBuyer(orderId: string, expectedVersion?: number): Promise<EscrowRpcResult> {
    const { data, error } = await this.db.rpc('buyer_confirm_order', {
      p_order_id: orderId,
      p_expected_version: expectedVersion ?? undefined,
    });

    if (error) throw mapPostgresError(error, { orderId, expectedVersion });
    return normalize(data, orderId);
  }

  async markDeliveredBySeller(
    orderId: string,
    summary: string,
    expectedVersion?: number,
  ): Promise<EscrowRpcResult> {
    const { data, error } = await this.db.rpc('seller_mark_delivered', {
      p_order_id: orderId,
      p_summary: summary,
      p_expected_version: expectedVersion ?? undefined,
    });

    if (error) throw mapPostgresError(error, { orderId });
    return normalize(data, orderId);
  }

  async openDispute(orderId: string, reason: string, expectedVersion?: number): Promise<EscrowRpcResult> {
    if (reason.trim().length < 10) {
      throw new EscrowError('VALIDATION_FAILED', 'причина спора слишком короткая');
    }

    const { data, error } = await this.db.rpc('open_dispute', {
      p_order_id: orderId,
      p_reason: reason.trim(),
      p_expected_version: expectedVersion ?? undefined,
    });

    if (error) throw mapPostgresError(error, { orderId });
    return normalize(data, orderId);
  }

  async resolveDispute(
    orderId: string,
    outcome: Extract<OrderStatus, 'COMPLETED' | 'REFUNDED'>,
    reason: string,
    expectedVersion?: number,
  ): Promise<EscrowRpcResult> {
    const { data, error } = await this.db.rpc('arbiter_resolve_dispute', {
      p_order_id: orderId,
      p_outcome: outcome,
      p_reason: reason,
      p_expected_version: expectedVersion ?? undefined,
    });

    if (error) throw mapPostgresError(error, { orderId, outcome });
    return normalize(data, orderId);
  }

  async createOrder(listingId: string, idempotencyKey: string): Promise<EscrowRpcResult> {
    const { data, error } = await this.db.rpc('escrow_create_order', {
      p_listing_id: listingId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) throw mapPostgresError(error, { listingId });
    return normalize(data, '');
  }

  async attachPaymentIntent(
    orderId: string,
    intentId: string,
    qrExpiresAt: Date,
  ): Promise<EscrowRpcResult> {
    const { data, error } = await this.db.rpc('escrow_attach_payment_intent', {
      p_order_id: orderId,
      p_intent_id: intentId,
      p_qr_expires_at: qrExpiresAt.toISOString(),
    });

    if (error) throw mapPostgresError(error, { orderId });
    return normalize(data, orderId);
  }

  /** Cron: экспирация QR и авто-релиз средств по SLA. Только service_role. */
  async runSlas(): Promise<{ expired: number; auto_released: number }> {
    const { data, error } = await this.db.rpc('escrow_run_slas');
    if (error) throw mapPostgresError(error);
    return data as unknown as { expired: number; auto_released: number };
  }
}
