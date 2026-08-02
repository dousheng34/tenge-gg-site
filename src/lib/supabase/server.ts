import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/** Клиент под сессией пользователя: все запросы проходят RLS. */
export async function createUserClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY не сконфигурированы');
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Вызов из Server Component — запись кук выполнит middleware.
        }
      },
    },
  });
}

export async function requireUserId(): Promise<string> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('UNAUTHENTICATED');
  }
  return data.user.id;
}
