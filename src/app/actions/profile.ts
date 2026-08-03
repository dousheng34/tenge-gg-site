'use server';

import { revalidatePath } from 'next/cache';

import { createUserClient } from '@/lib/supabase/server';
import {
  isListingStatus,
  reviewSchema,
  sellerProfileSchema,
  type ListingStatus,
} from '@/lib/validation/profile.schema';

export interface ProfileActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

const UNAUTH: ProfileActionState = { ok: false, error: 'UNAUTHENTICATED', message: 'Требуется вход в аккаунт.' };

/** Профиль продавца: upsert, потому что строка в sellers может ещё не существовать. */
export async function updateSellerProfileAction(input: {
  nickname: string;
  city?: string;
}): Promise<ProfileActionState> {
  const parsed = sellerProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message ?? 'Проверьте поля' };
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return UNAUTH;

  const { error } = await supabase.from('sellers').upsert(
    {
      user_id: auth.user.id,
      nickname: parsed.data.nickname,
      city: parsed.data.city && parsed.data.city.length > 0 ? parsed.data.city : null,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { ok: false, error: 'INTERNAL', message: error.message };

  revalidatePath('/profile');
  return { ok: true, message: 'Профиль обновлён' };
}

/**
 * Смена статуса своего лота. Фильтр по seller_id дублирует RLS: если политика когда-нибудь
 * ослабнет, запрос всё равно не тронет чужие строки.
 */
export async function setMyListingStatusAction(
  listingId: string,
  status: ListingStatus,
): Promise<ProfileActionState> {
  if (!isListingStatus(status)) {
    return { ok: false, error: 'VALIDATION_FAILED', message: 'Неизвестный статус лота' };
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return UNAUTH;

  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', listingId)
    .eq('seller_id', auth.user.id);

  if (error) return { ok: false, error: 'INTERNAL', message: error.message };

  revalidatePath('/profile');
  revalidatePath('/catalog');
  revalidatePath(`/lot/${listingId}`);
  revalidatePath('/');

  return { ok: true, message: status === 'active' ? 'Лот снова в продаже' : 'Лот скрыт из каталога' };
}

/**
 * Отзыв покупателя по завершённой сделке.
 * `had_dispute` фиксируем из самой сделки, чтобы рейтинг нельзя было «отмыть» текстом.
 */
export async function submitReviewAction(input: {
  orderId: string;
  rating: number;
  text: string;
}): Promise<ProfileActionState> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'VALIDATION_FAILED', message: parsed.error.issues[0]?.message ?? 'Проверьте поля' };
  }

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return UNAUTH;

  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_id, status, listing_title, dispute_opened_at')
    .eq('id', parsed.data.orderId)
    .maybeSingle();

  if (!order || order.buyer_id !== auth.user.id) {
    return { ok: false, error: 'FORBIDDEN', message: 'Отзыв можно оставить только по своей сделке.' };
  }
  if (order.status !== 'COMPLETED') {
    return { ok: false, error: 'CONFLICT', message: 'Сделка ещё не завершена.' };
  }

  const { data: seller } = await supabase
    .from('sellers')
    .select('nickname, city')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  const authorName = seller?.nickname ?? auth.user.email?.split('@')[0] ?? 'Покупатель';

  const { error } = await supabase.from('reviews').insert({
    order_id: order.id,
    author_id: auth.user.id,
    author_name: authorName,
    city: seller?.city ?? null,
    subject: order.listing_title,
    rating: parsed.data.rating,
    text: parsed.data.text,
    had_dispute: order.dispute_opened_at !== null,
  });

  if (error) {
    // Уникальный индекс на (order_id, author_id) — повторный отзыв отклоняется базой.
    const duplicate = error.code === '23505' || error.code === '23514' || /duplicate/i.test(error.message);
    return {
      ok: false,
      error: duplicate ? 'ALREADY_REVIEWED' : 'INTERNAL',
      message: duplicate ? 'Отзыв по этой сделке уже оставлен.' : error.message,
    };
  }

  revalidatePath('/profile');
  revalidatePath('/');
  return { ok: true, message: 'Спасибо за отзыв' };
}
