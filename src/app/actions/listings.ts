'use server';

import { revalidatePath } from 'next/cache';

import { EscrowError } from '@/lib/escrow/errors';
import { EscrowService } from '@/services/escrow.service';
import { logSecurityEvent } from '@/lib/security/audit';
import { describeFindings, scanForContactLeaks } from '@/lib/security/contact-leak';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { normalizeUserText } from '@/lib/security/text';
import { createUserClient } from '@/lib/supabase/server';
import { createListingSchema } from '@/lib/validation/listing.schema';

export interface ListingActionState {
  ok: boolean;
  id?: string;
  error?: string;
  message?: string;
}

const OFF_PLATFORM_WARNING =
  'Оплата только через сделку на сайте. Перевод напрямую не защищён escrow: вернуть деньги будет нечем.';

/** Создание лота. Схема та же, что в форме, — клиентская валидация не доверенная. */
export async function createListingAction(input: {
  title: string;
  price: string;
  description: string;
  game_type: string;
  category: string;
}): Promise<ListingActionState> {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };

  const limit = await enforceRateLimit(supabase, 'listing_create');
  if (!limit.allowed) return { ok: false, error: 'RATE_LIMITED', message: limit.message };

  // Нормализация до валидации: иначе лимиты длины обходятся zero-width символами.
  const normalized = {
    title: normalizeUserText(input.title, { maxLength: 80 }),
    price: input.price,
    description: normalizeUserText(input.description, { maxLength: 2000, allowNewlines: true }),
  };

  const parsed = createListingSchema.safeParse(normalized);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message ?? 'Проверьте поля' };
  }

  /**
   * В лоте контакты не маскируются, а отклоняются: замаскированное объявление выглядит
   * сломанным, а продавец всё равно узнает правило только после публикации.
   */
  const scan = scanForContactLeaks(`${parsed.data.title}\n${parsed.data.description}`);
  if (scan.findings.length > 0) {
    logSecurityEvent({
      event: scan.blocked ? 'listing.payment_details_blocked' : 'listing.leak_masked',
      actorId: auth.user.id,
      findings: scan.findings,
    });

    return {
      ok: false,
      error: 'CONTACT_LEAK',
      message: `Уберите из описания: ${describeFindings(scan.findings)}. ${OFF_PLATFORM_WARNING}`,
    };
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description,
      price: parsed.data.price,
      game_type: input.game_type,
      category: input.category,
      status: 'active',
      seller_id: auth.user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: 'INTERNAL', message: error.message };

  revalidatePath('/catalog');
  revalidatePath('/');
  return { ok: true, id: data.id, message: 'Лот опубликован' };
}

/** Покупка: создаём заказ (CREATED) и получаем сумму к оплате Kaspi QR. */
export async function startOrderAction(listingId: string, idempotencyKey: string) {
  try {
    const service = await EscrowService.withUserSession();
    const result = await service.createOrder(listingId, idempotencyKey);
    revalidatePath('/orders');
    return { ok: true as const, orderId: result.orderId, status: result.status };
  } catch (error) {
    if (error instanceof EscrowError) return { ok: false as const, message: error.userMessage };
    return { ok: false as const, message: 'Не удалось создать сделку' };
  }
}

export interface TradeMessageResult {
  ok: boolean;
  message?: string;
  /** Часть текста заменена на [скрыто] — клиент показывает предупреждение. */
  masked?: boolean;
  /** Что именно нашли: для тоста, без самих реквизитов. */
  warning?: string;
}

/**
 * Отправка сообщения в чат сделки.
 *
 * Порядок проверок важен: лимит частоты -> нормализация -> сканер контактов -> запись.
 * Платёжные реквизиты в БД не попадают вообще, остальные контакты маскируются, но
 * сообщение доставляется: полный блок обычной переписки только выталкивает людей в Telegram.
 */
export async function sendTradeMessageAction(orderId: string, body: string): Promise<TradeMessageResult> {
  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: 'Требуется вход' };

  const limit = await enforceRateLimit(supabase, 'chat_send');
  if (!limit.allowed) return { ok: false, message: limit.message };

  const text = normalizeUserText(body, { maxLength: 2000, allowNewlines: true });
  if (text.length === 0) return { ok: false, message: 'Пустое сообщение' };

  const scan = scanForContactLeaks(text);

  if (scan.blocked) {
    logSecurityEvent({
      event: 'chat.payment_details_blocked',
      actorId: auth.user.id,
      entityId: orderId,
      findings: scan.findings,
    });

    return {
      ok: false,
      message: `Нельзя пересылать ${describeFindings(scan.findings)}. ${OFF_PLATFORM_WARNING}`,
    };
  }

  const { error } = await supabase
    .from('trade_messages')
    .insert({ order_id: orderId, sender_id: auth.user.id, body: scan.text });

  if (error) return { ok: false, message: error.message };

  if (scan.findings.length > 0) {
    logSecurityEvent({
      event: 'chat.leak_masked',
      actorId: auth.user.id,
      entityId: orderId,
      findings: scan.findings,
    });
  }

  revalidatePath(`/orders/${orderId}`);

  return {
    ok: true,
    masked: scan.findings.length > 0,
    warning: scan.findings.length > 0 ? describeFindings(scan.findings) : undefined,
  };
}
