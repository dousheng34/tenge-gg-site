import type { Metadata } from 'next';

import { AuthForm } from '@/components/auth/AuthForm';

export const metadata: Metadata = { title: 'Вход' };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AuthPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const next = (Array.isArray(sp.next) ? sp.next[0] : sp.next) ?? '/orders';

  return (
    <div className="section flex max-w-sm flex-col py-16">
      <h1 className="font-display text-2xl tracking-tight">Вход в tenge.gg</h1>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Ссылка для входа придёт на почту. Пароль не нужен — меньше поверхность атаки.
      </p>
      <div className="card mt-6 p-5">
        <AuthForm next={next} />
      </div>
    </div>
  );
}
