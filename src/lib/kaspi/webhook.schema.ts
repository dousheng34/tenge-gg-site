import { z } from 'zod';

/**
 * Контракт вебхука Kaspi QR. Сумма приходит в тенге (может быть дробной),
 * внутри системы деньги живут только в тиынах (minor units, bigint).
 */

export const KASPI_EVENT_TYPES = [
  'payment.completed',
  'payment.failed',
  'payment.cancelled',
  'payment.refunded',
] as const;

export const kaspiWebhookSchema = z.object({
  /** Уникальный идентификатор события — ключ идемпотентности. */
  eventId: z.string().min(1).max(200),
  eventType: z.enum(KASPI_EVENT_TYPES),
  /** ID платежа на стороне Kaspi. */
  paymentId: z.string().min(1).max(200),
  /** orderId нашей системы, переданный при выпуске QR. */
  orderId: z.string().uuid(),
  amount: z.number().finite().nonnegative(),
  currency: z.literal('KZT'),
  createdAt: z.string().datetime().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type KaspiWebhookPayload = z.infer<typeof kaspiWebhookSchema>;

/** Тенге -> тиыны без ошибок плавающей точки. */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
