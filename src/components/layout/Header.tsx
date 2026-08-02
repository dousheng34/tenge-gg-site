import Link from 'next/link';

import { CommandPalette } from './CommandPalette';
import { ThemeToggle } from './ThemeToggle';
import { getCurrentUser } from '@/lib/queries';

const LINKS = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/sell', label: 'Продать' },
  { href: '/orders', label: 'Сделки' },
];

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-[rgb(var(--bg))]/85 backdrop-blur dark:border-neutral-800">
      <div className="section flex h-14 items-center gap-4">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-[-0.02em]">
          tenge<span className="text-[rgb(var(--accent))]">.gg</span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-2.5 py-1.5 text-xs uppercase tracking-[0.08em] text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CommandPalette />
          <ThemeToggle />
          {user ? (
            <Link
              href="/orders"
              className="grid size-8 place-items-center rounded-full bg-neutral-900 text-[11px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              aria-label="Личный кабинет"
              title={user.email ?? 'Профиль'}
            >
              {(user.email?.[0] ?? 'U').toUpperCase()}
            </Link>
          ) : (
            <Link
              href="/auth"
              className="border border-neutral-900 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] dark:border-neutral-100"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
