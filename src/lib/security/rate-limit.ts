import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

/**
 * Лимиты частоты запросов.
 *
 * Счётчик живёт в Postgres (`public.check_rate` + таблица `public.rate_limit`), а не в Redis:
 * Redis добавил бы отдельную точку отказа и рассинхрон с транзакцией, а окно в БД идёт
 * ровно там же, где применяется изменение. При этом функция вызывается под сессией
 * пользователя, поэтому actor берётся из auth.uid() внутри БД — подделать нельзя.
 */

export const RATE_POLICIES = {
  chat_send: { limit: 30, minutes: 1 },
  listing_create: { limit: 10, minutes: 60 },
  review_create: { limit: 5, minutes: 60 },
  profile_update: { limit: 20, minutes: 10 },
  dispute_open: { limit: 3, minutes: 60 },
} as const;

export type RateAction = keyof typeof RATE_POLICIES;

export interface RateVerdict {
  allowed: boolean;
  message?: string;
}

const TOO_FAST = 'Слишком часто. Подождите немного и повторите.';

/**
 * Возвращает verdict вместо исключения: вызывающий код — Server Action, который обязан
 * ответить пользователю понятным текстом, а не 500.
 *
 * Fail-open, если функции нет в базе (например, миграция ещё не применена): ломать чат
 * из-за отсутствующего лимитера хуже, чем на время остаться без лимита. Событие пишется
 * в лог, чтобы это не осталось незамеченным.
 */
export async function enforceRateLimit(
  db: SupabaseClient<Database>,
  action: RateAction,
): Promise<RateVerdict> {
  const policy = RATE_POLICIES[action];

  const { error } = await db.rpc('check_rate', {
    p_action: action,
    p_limit: policy.limit,
    p_minutes: policy.minutes,
  });

  if (!error) return { allowed: true };

  const missing = error.code === '42883' || /does not exist|not find function/i.test(error.message);
  if (missing) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'rate_limit.unavailable',
        action,
        detail: error.message,
      }),
    );
    return { allowed: true };
  }

  return { allowed: false, message: TOO_FAST };
}
