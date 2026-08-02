import { z } from 'zod';

/** Ограничения совпадают с CHECK-констрейнтами public.listings. */
export const LISTING_LIMITS = {
  title: { min: 4, max: 80 },
  description: { min: 10, max: 2000 },
  price: { min: 1, max: 5_000_000 },
} as const;

const digitsOnly = /^\d+$/;

export const createListingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(LISTING_LIMITS.title.min, `Минимум ${LISTING_LIMITS.title.min} символа`)
    .max(LISTING_LIMITS.title.max, `Максимум ${LISTING_LIMITS.title.max} символов`),

  price: z
    .string()
    .trim()
    .min(1, 'Укажите цену')
    .regex(digitsOnly, 'Только цифры, без пробелов и знаков')
    .transform((value) => Number.parseInt(value, 10))
    .pipe(
      z
        .number()
        .int('Цена указывается в целых тенге')
        .gt(0, 'Цена должна быть больше нуля')
        .max(LISTING_LIMITS.price.max, `Максимум ${LISTING_LIMITS.price.max.toLocaleString('ru-KZ')} ₸`),
    ),

  description: z
    .string()
    .trim()
    .min(LISTING_LIMITS.description.min, `Опишите лот подробнее — минимум ${LISTING_LIMITS.description.min} символов`)
    .max(LISTING_LIMITS.description.max, `Максимум ${LISTING_LIMITS.description.max} символов`),
});

/** Значения формы до трансформации (всё, что реально лежит в инпутах). */
export type CreateListingInput = z.input<typeof createListingSchema>;
/** Значения после валидации: price уже number. */
export type CreateListingValues = z.output<typeof createListingSchema>;

/** Комиссия платформы 5% — показываем покупателю до отправки. */
export function calcFee(priceMinorUnitsFree: number, rate = 0.05): number {
  return Math.round(priceMinorUnitsFree * rate);
}

export function formatTenge(value: number): string {
  return `${value.toLocaleString('ru-KZ')} ₸`;
}
