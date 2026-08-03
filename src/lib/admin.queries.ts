import 'server-only';

import { cache } from 'react';

import type { Database } from '@/types/database.types';
import type { Listing, Order } from '@/lib/queries';
import { createUserClient } from '@/lib/supabase/server';

export type Lead = Database['public']['Tables']['early_leads']['Row'];

/**
 * Роль проверяется той же функцией, что и в политиках RLS, — один источник истины.
 * Никаких ролей из localStorage, как было в legacy admin.html.
 */
export const isStaff = cache(async (): Promise<boolean> => {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc('is_staff');
  return !error && data === true;
});

export interface AdminOverview {
  activeListings: number;
  orders: number;
  disputes: number;
  completed: number;
  leads: number;
  gmv: number;
}

export const getAdminOverview = cache(async (): Promise<AdminOverview> => {
  const supabase = await createUserClient();

  const [activeListings, orders, disputes, leads, settled] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'DISPUTE'),
    supabase.from('early_leads').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('escrow_amount').eq('status', 'COMPLETED').limit(1000),
  ]);

  const rows = settled.data ?? [];

  return {
    activeListings: activeListings.count ?? 0,
    orders: orders.count ?? 0,
    disputes: disputes.count ?? 0,
    completed: rows.length,
    leads: leads.count ?? 0,
    gmv: rows.reduce((sum, row) => sum + (row.escrow_amount ?? 0), 0),
  };
});

export const getAllListings = cache(async (limit = 30): Promise<Listing[]> => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
});

export const getAllOrders = cache(async (limit = 20): Promise<Order[]> => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
});

export const getLeads = cache(async (limit = 50): Promise<Lead[]> => {
  const supabase = await createUserClient();
  const { data } = await supabase
    .from('early_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
});
