import 'server-only';

import { cache } from 'react';

import { createUserClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database.types';

export type Listing = Database['public']['Tables']['listings']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type Seller = Database['public']['Tables']['sellers']['Row'];
export type TradeMessage = Database['public']['Tables']['trade_messages']['Row'];
export type OrderStatus = Database['public']['Enums']['order_status'];

export interface CatalogFilters {
  game?: string;
  category?: string;
  q?: string;
  sort?: 'new' | 'cheap' | 'expensive';
  page?: number;
}

const PAGE_SIZE = 24;

/** cache() дедуплицирует одинаковые запросы в пределах одного RSC-рендера. */
export const getCurrentUser = cache(async () => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getCatalog = cache(async (filters: CatalogFilters) => {
  const supabase = await createUserClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('status', 'active')
    .range(from, from + PAGE_SIZE - 1);

  if (filters.game) query = query.eq('game_type', filters.game);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.q) query = query.ilike('title', `%${filters.q.replace(/[%_]/g, '')}%`);

  query =
    filters.sort === 'cheap'
      ? query.order('price', { ascending: true })
      : filters.sort === 'expensive'
        ? query.order('price', { ascending: false })
        : query.order('created_at', { ascending: false });

  const { data, count, error } = await query;
  if (error) throw error;

  return { items: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
});

export const getListing = cache(async (id: string) => {
  const supabase = await createUserClient();
  const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
  return data;
});

export const getSeller = cache(async (userId: string | null) => {
  if (!userId) return null;
  const supabase = await createUserClient();
  const { data } = await supabase.from('sellers').select('*').eq('user_id', userId).maybeSingle();
  return data;
});

export const getSellerReviews = cache(async (sellerId: string | null, limit = 5) => {
  if (!sellerId) return [];
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('status', 'COMPLETED')
    .limit(50);

  const ids = (data ?? []).map((o) => o.id);
  if (ids.length === 0) return [];

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .in('order_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit);

  return reviews ?? [];
});

/** RLS сама отдаёт только свои сделки — фильтр по роли делается ради разделения вкладок. */
export const getMyOrders = cache(async (role: 'buyer' | 'seller') => {
  const supabase = await createUserClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq(role === 'buyer' ? 'buyer_id' : 'seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return data ?? [];
});

export const getOrder = cache(async (id: string) => {
  const supabase = await createUserClient();
  const { data } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  return data;
});

export const getOrderMessages = cache(async (orderId: string) => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('trade_messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(200);
  return data ?? [];
});

export const getDisputeQueue = cache(async () => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('dispute_queue')
    .select('*')
    .order('dispute_opened_at', { ascending: true });
  return data ?? [];
});

export const getSalesFeed = cache(async (limit = 8) => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('sales_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
});

export const getMarketStats = cache(async () => {
  const supabase = await createUserClient();
  const [{ count: lots }, { count: deals }] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
  ]);
  return { lots: lots ?? 0, deals: deals ?? 0 };
});
