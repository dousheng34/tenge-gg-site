import 'server-only';

import { cache } from 'react';

import { getCurrentUser, type Listing, type Order, type Review, type Seller } from '@/lib/queries';
import { createUserClient } from '@/lib/supabase/server';

/** Профиль продавца текущего пользователя. Может отсутствовать: создаётся при первой продаже. */
export const getMySellerProfile = cache(async (): Promise<Seller | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createUserClient();
  const { data } = await supabase.from('sellers').select('*').eq('user_id', user.id).maybeSingle();
  return data;
});

/** Все лоты пользователя, включая снятые с продажи, — RLS отдаёт только свои. */
export const getMyListings = cache(async (): Promise<Listing[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createUserClient();
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return data ?? [];
});

/** Отзывы о моих продажах: reviews привязаны к order_id, а не к продавцу напрямую. */
export const getReviewsAboutMe = cache(async (limit = 20): Promise<Review[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createUserClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('seller_id', user.id)
    .eq('status', 'COMPLETED')
    .limit(200);

  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('reviews')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
});

/**
 * Завершённые покупки, по которым я ещё не оставил отзыв.
 * Ограничение «один отзыв на сделку» держит БД, здесь — только чтобы не показывать форму дважды.
 */
export const getOrdersAwaitingMyReview = cache(async (): Promise<Order[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createUserClient();
  const [{ data: orders }, { data: reviews }] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', user.id)
      .eq('status', 'COMPLETED')
      .order('resolved_at', { ascending: false })
      .limit(50),
    supabase.from('reviews').select('order_id').eq('author_id', user.id).limit(200),
  ]);

  const reviewed = new Set((reviews ?? []).map((r) => r.order_id));
  return (orders ?? []).filter((o) => !reviewed.has(o.id));
});

export interface ProfileStats {
  activeListings: number;
  sales: number;
  purchases: number;
  rating: number | null;
  reviews: number;
}

/** head:true — считаем строки без их выгрузки. */
export const getMyProfileStats = cache(async (): Promise<ProfileStats> => {
  const user = await getCurrentUser();
  const empty: ProfileStats = { activeListings: 0, sales: 0, purchases: 0, rating: null, reviews: 0 };
  if (!user) return empty;

  const supabase = await createUserClient();
  const [activeListings, sales, purchases, reviews] = await Promise.all([
    supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('status', 'active'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('status', 'COMPLETED'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .eq('status', 'COMPLETED'),
    getReviewsAboutMe(100),
  ]);

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => typeof r === 'number');
  const rating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return {
    activeListings: activeListings.count ?? 0,
    sales: sales.count ?? 0,
    purchases: purchases.count ?? 0,
    rating,
    reviews: ratings.length,
  };
});
