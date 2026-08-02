'use server';

import { revalidatePath } from 'next/cache';

import { EscrowError } from '@/lib/escrow/errors';
import type { OrderStatus } from '@/lib/escrow/state-machine';
import { EscrowService } from '@/services/escrow.service';
import { createUserClient } from '@/lib/supabase/server';

export interface ActionState {
  ok: boolean;
  status?: OrderStatus | null;
  version?: number | null;
  error?: string;
  message?: string;
}

function fail(error: unknown): ActionState {
  if (error instanceof EscrowError) {
    return { ok: false, error: error.code, message: error.userMessage };
  }
  console.error('[escrow.action.failed]', error);
  return { ok: false, error: 'INTERNAL', message: 'Внутренняя ошибка. Попробуйте позже.' };
}

async function requireSession(): Promise<string | null> {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Подтверждение сделки покупателем.
 * expectedVersion приходит из UI (orders.version, который видел пользователь):
 * если между отрисовкой и кликом продавец/арбитр изменили сделку —
 * действие отклоняется с VERSION_CONFLICT вместо «слепой» перезаписи.
 */
export async function confirmOrderAction(
  orderId: string,
  expectedVersion?: number,
): Promise<ActionState> {
  try {
    if (!(await requireSession())) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };
    }

    const service = await EscrowService.withUserSession();
    const result = await service.confirmOrderByBuyer(orderId, expectedVersion);

    revalidatePath('/profile');
    revalidatePath(`/orders/${orderId}`);

    return {
      ok: true,
      status: result.status,
      version: result.version,
      message: result.idempotent ? 'Сделка уже подтверждена.' : 'Сделка подтверждена, выплата продавцу поставлена в очередь.',
    };
  } catch (error) {
    return fail(error);
  }
}

export async function markDeliveredAction(
  orderId: string,
  summary: string,
  expectedVersion?: number,
): Promise<ActionState> {
  try {
    if (!(await requireSession())) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };
    }

    const service = await EscrowService.withUserSession();
    const result = await service.markDeliveredBySeller(orderId, summary, expectedVersion);

    revalidatePath('/profile');
    revalidatePath(`/orders/${orderId}`);

    return { ok: true, status: result.status, version: result.version, message: 'Данные отмечены как переданные.' };
  } catch (error) {
    return fail(error);
  }
}

export async function openDisputeAction(
  orderId: string,
  reason: string,
  expectedVersion?: number,
): Promise<ActionState> {
  try {
    if (!(await requireSession())) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };
    }

    const service = await EscrowService.withUserSession();
    const result = await service.openDispute(orderId, reason, expectedVersion);

    revalidatePath('/profile');
    revalidatePath(`/orders/${orderId}`);

    return { ok: true, status: result.status, version: result.version, message: 'Спор открыт, деньги заморожены до решения арбитра.' };
  } catch (error) {
    return fail(error);
  }
}

export async function resolveDisputeAction(
  orderId: string,
  outcome: 'COMPLETED' | 'REFUNDED',
  reason: string,
  expectedVersion?: number,
): Promise<ActionState> {
  try {
    if (!(await requireSession())) {
      return { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };
    }

    const service = await EscrowService.withUserSession();
    const result = await service.resolveDispute(orderId, outcome, reason, expectedVersion);

    revalidatePath('/admin/disputes');
    revalidatePath(`/orders/${orderId}`);

    return { ok: true, status: result.status, version: result.version, message: 'Решение арбитра применено.' };
  } catch (error) {
    return fail(error);
  }
}
