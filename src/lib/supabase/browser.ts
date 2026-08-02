'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

let client: SupabaseClient<Database> | null = null;

/** Синглтон: несколько клиентов = несколько websocket-подключений и гонки refresh-токена. */
export function getBrowserClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
