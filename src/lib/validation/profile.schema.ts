import { z } from 'zod';

/** Ограничения совпадают с CHECK-констрейнтами public.sellers и public.reviews. */
export const PROFILE_LIMITS = {
  nickname: { min: 3, max: 24 },
  city: { max: 40 },
  reviewText: { min: 10, max: 1000 },
} as const;

export const sellerProfileSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(PROFILE_LIMITS.nickname.min, `Минимум ${PROFILE_LIMITS.nickname.min} символа`)
    .max(PROFILE_LIMITS.nickname.max, `Максимум ${PROFILE_LIMITS.nickname.max} символа`)
    .regex(/^[\p{L}\p{N} _.-]+$/u, 'Только буквы, цифры, пробел и символы _ . -'),

  city: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.city.max, `Максимум ${PROFILE_LIMITS.city.max} символов`)
    .optional(),
});

export type SellerProfileInput = z.input<typeof sellerProfileSchema>;

export const reviewSchema = z.object({
  orderId: z.string().uuid('Некорректная сделка'),
  rating: z
    .number()
    .int('Оценка — целое число')
    .min(1, 'Поставьте оценку от 1 до 5')
    .max(5, 'Оценка от 1 до 5'),
  text: z
    .string()
    .trim()
    .min(PROFILE_LIMITS.reviewText.min, `Минимум ${PROFILE_LIMITS.reviewText.min} символов`)
    .max(PROFILE_LIMITS.reviewText.max, `Максимум ${PROFILE_LIMITS.reviewText.max} символов`),
});

export type ReviewInput = z.input<typeof reviewSchema>;

/**
 * Статусы лота, которыми управляет сам продавец.
 * `removed` — мягкое удаление: лот исчезает из каталога, но история сделок остаётся.
 */
export const LISTING_STATUSES = ['active', 'paused', 'removed'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Readonly<Record<ListingStatus, string>> = Object.freeze({
  active: 'В продаже',
  paused: 'Снят с продажи',
  removed: 'Удалён',
});

export function isListingStatus(value: string): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}
