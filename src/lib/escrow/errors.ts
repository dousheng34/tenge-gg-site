/**
 * Доменные ошибки escrow. SQLSTATE-коды приходят из PL/pgSQL-функций
 * стейт-машины (см. supabase/migrations/*_escrow_state_machine_core.sql).
 */

export const ESCROW_ERROR_CODES = {
  ESC01: 'INVALID_TRANSITION',
  ESC02: 'VERSION_CONFLICT',
  ESC03: 'FORBIDDEN',
  ESC04: 'ORDER_NOT_FOUND',
  ESC05: 'VALIDATION_FAILED',
  ESC06: 'APPEND_ONLY_VIOLATION',
} as const;

export type EscrowSqlState = keyof typeof ESCROW_ERROR_CODES;
export type EscrowErrorCode =
  | (typeof ESCROW_ERROR_CODES)[EscrowSqlState]
  | 'SIGNATURE_INVALID'
  | 'PAYLOAD_INVALID'
  | 'AMOUNT_MISMATCH'
  | 'UNAUTHENTICATED'
  | 'INTERNAL';

const HTTP_STATUS: Record<EscrowErrorCode, number> = {
  INVALID_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  FORBIDDEN: 403,
  ORDER_NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  APPEND_ONLY_VIOLATION: 409,
  SIGNATURE_INVALID: 401,
  PAYLOAD_INVALID: 400,
  AMOUNT_MISMATCH: 422,
  UNAUTHENTICATED: 401,
  INTERNAL: 500,
};

/** Сообщения для UI: без деталей внутренней логики. */
const USER_MESSAGE: Record<EscrowErrorCode, string> = {
  INVALID_TRANSITION: 'Действие недоступно для текущего статуса сделки.',
  VERSION_CONFLICT: 'Сделка изменилась. Обновите страницу и повторите.',
  FORBIDDEN: 'Недостаточно прав для этого действия.',
  ORDER_NOT_FOUND: 'Сделка не найдена.',
  VALIDATION_FAILED: 'Проверьте введённые данные.',
  APPEND_ONLY_VIOLATION: 'Историю сделки нельзя изменить.',
  SIGNATURE_INVALID: 'Подпись запроса недействительна.',
  PAYLOAD_INVALID: 'Некорректное тело запроса.',
  AMOUNT_MISMATCH: 'Сумма платежа не совпадает с суммой заказа.',
  UNAUTHENTICATED: 'Требуется вход в аккаунт.',
  INTERNAL: 'Внутренняя ошибка. Мы уже знаем о проблеме.',
};

export class EscrowError extends Error {
  readonly code: EscrowErrorCode;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    code: EscrowErrorCode,
    message?: string,
    context: Record<string, unknown> = {},
    options: { retryable?: boolean } = {},
  ) {
    super(message ?? USER_MESSAGE[code]);
    this.name = 'EscrowError';
    this.code = code;
    this.httpStatus = HTTP_STATUS[code];
    this.userMessage = USER_MESSAGE[code];
    this.retryable = options.retryable ?? code === 'INTERNAL';
    this.context = Object.freeze({ ...context });
  }

  toJSON() {
    return { error: this.code, message: this.userMessage };
  }
}

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

function isEscrowSqlState(code: string): code is EscrowSqlState {
  return code in ESCROW_ERROR_CODES;
}

/** Преобразует ошибку PostgREST/PostgreSQL в доменную ошибку. */
export function mapPostgresError(
  error: PostgrestLikeError | null | undefined,
  context: Record<string, unknown> = {},
): EscrowError {
  const sqlState = error?.code ?? '';

  if (isEscrowSqlState(sqlState)) {
    return new EscrowError(ESCROW_ERROR_CODES[sqlState], error?.message ?? undefined, {
      ...context,
      sqlState,
    });
  }

  switch (sqlState) {
    case '23505': // unique_violation — идемпотентность сработала как задумано
      return new EscrowError('INVALID_TRANSITION', error?.message ?? undefined, {
        ...context,
        sqlState,
      });
    case '42501': // insufficient_privilege — RLS
      return new EscrowError('FORBIDDEN', error?.message ?? undefined, { ...context, sqlState });
    case '40001': // serialization_failure
    case '40P01': // deadlock_detected
    case '55P03': // lock_not_available
      return new EscrowError(
        'VERSION_CONFLICT',
        error?.message ?? undefined,
        { ...context, sqlState },
        { retryable: true },
      );
    default:
      return new EscrowError('INTERNAL', error?.message ?? 'unknown database error', {
        ...context,
        sqlState,
      });
  }
}

export function isRetryable(error: unknown): boolean {
  return error instanceof EscrowError && error.retryable;
}
