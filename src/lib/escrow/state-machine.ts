/**
 * Зеркало графа переходов из public.escrow_transition_allowed().
 * ИСТОЧНИК ПРАВДЫ — база. Этот модуль нужен для типобезопасного UI
 * (какие кнопки показывать) и для fail-fast проверок до сетевого вызова.
 *
 * Инвариант: любое изменение SQL-графа обязано отражаться здесь,
 * контроль — тестом supabase/tests/escrow_state_machine_test.sql + CI-диффом.
 */

export const ORDER_STATUSES = [
  'CREATED',
  'PENDING_PAYMENT',
  'ESCROW_HOLD',
  'VERIFYING',
  'DISPUTE',
  'COMPLETED',
  'REFUNDED',
  'CANCELLED',
  'EXPIRED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ESCROW_ACTORS = ['BUYER', 'SELLER', 'ARBITER', 'SYSTEM'] as const;
export type EscrowActor = (typeof ESCROW_ACTORS)[number];

export const TERMINAL_STATUSES = ['COMPLETED', 'REFUNDED', 'CANCELLED', 'EXPIRED'] as const;
export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export type TransitionMap = Readonly<Record<EscrowActor, Readonly<Record<OrderStatus, readonly OrderStatus[]>>>>;

const NONE: readonly OrderStatus[] = Object.freeze([]);

function table(edges: Partial<Record<OrderStatus, readonly OrderStatus[]>>): Record<OrderStatus, readonly OrderStatus[]> {
  return ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = Object.freeze(edges[status] ?? NONE);
    return acc;
  }, {} as Record<OrderStatus, readonly OrderStatus[]>);
}

export const TRANSITIONS: TransitionMap = Object.freeze({
  SYSTEM: table({
    CREATED: ['PENDING_PAYMENT', 'ESCROW_HOLD', 'EXPIRED', 'CANCELLED'],
    PENDING_PAYMENT: ['ESCROW_HOLD', 'EXPIRED', 'CANCELLED'],
    ESCROW_HOLD: ['REFUNDED'],
    VERIFYING: ['COMPLETED'],
  }),
  BUYER: table({
    CREATED: ['PENDING_PAYMENT', 'CANCELLED'],
    PENDING_PAYMENT: ['CANCELLED'],
    ESCROW_HOLD: ['COMPLETED', 'DISPUTE'],
    VERIFYING: ['COMPLETED', 'DISPUTE'],
  }),
  SELLER: table({
    ESCROW_HOLD: ['VERIFYING', 'REFUNDED'],
    VERIFYING: ['DISPUTE'],
  }),
  ARBITER: table({
    ESCROW_HOLD: ['DISPUTE'],
    VERIFYING: ['DISPUTE'],
    DISPUTE: ['COMPLETED', 'REFUNDED'],
  }),
});

export function isTerminal(status: OrderStatus): status is TerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function canTransition(from: OrderStatus, to: OrderStatus, actor: EscrowActor): boolean {
  if (isTerminal(from)) return false;
  return TRANSITIONS[actor][from].includes(to);
}

export function allowedTransitions(from: OrderStatus, actor: EscrowActor): readonly OrderStatus[] {
  return isTerminal(from) ? NONE : TRANSITIONS[actor][from];
}

/** Роль пользователя относительно конкретной сделки. */
export function actorFor(
  userId: string,
  order: { buyer_id: string | null; seller_id: string | null },
  opts: { isArbiter?: boolean } = {},
): EscrowActor | null {
  if (order.buyer_id === userId) return 'BUYER';
  if (order.seller_id === userId) return 'SELLER';
  if (opts.isArbiter) return 'ARBITER';
  return null;
}

/** Деньги на транзитном счёте ТОО: возврат/выплата ещё возможны. */
export function isEscrowFunded(status: OrderStatus): boolean {
  return status === 'ESCROW_HOLD' || status === 'VERIFYING' || status === 'DISPUTE';
}

export const STATUS_LABELS_RU: Readonly<Record<OrderStatus, string>> = Object.freeze({
  CREATED: 'Создан',
  PENDING_PAYMENT: 'Ожидает оплаты Kaspi QR',
  ESCROW_HOLD: 'Деньги на escrow-счёте',
  VERIFYING: 'Проверка покупателем',
  DISPUTE: 'Спор — арбитраж',
  COMPLETED: 'Завершён, выплата продавцу',
  REFUNDED: 'Возврат покупателю',
  CANCELLED: 'Отменён',
  EXPIRED: 'Просрочен',
});

/** Статусы БД включают DEPRECATED-алиасы легаси-фронтенда. */
export type DbOrderStatus = OrderStatus | 'FUNDS_HOLD' | 'DATA_TRANSFERRED';

const LEGACY: Record<string, OrderStatus> = {
  FUNDS_HOLD: 'ESCROW_HOLD',
  DATA_TRANSFERRED: 'VERIFYING',
};

/** Приводит значение из БД к каноническому статусу стейт-машины. */
export function normalizeStatus(status: DbOrderStatus | string): OrderStatus {
  return LEGACY[status] ?? ((ORDER_STATUSES as readonly string[]).includes(status) ? (status as OrderStatus) : 'CREATED');
}
