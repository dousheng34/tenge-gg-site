'use client';

import { useCallback, useDeferredValue, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { cn } from '@/lib/cn';
import { CATEGORIES, GAMES } from '@/lib/format';

/**
 * Состояние фильтров живёт в URL: выдача шарится ссылкой, «назад» работает,
 * а сам список рендерится на сервере (RSC) — клиенту не нужен весь каталог.
 */
export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get('q') ?? '');
  const deferredQ = useDeferredValue(q);

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete('page');
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (deferredQ === current) return;
    const timer = setTimeout(() => push({ q: deferredQ || null }), 250);
    return () => clearTimeout(timer);
  }, [deferredQ, params, push]);

  const game = params.get('game');
  const category = params.get('category');
  const sort = params.get('sort') ?? 'new';

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Что ищем? Например: UC PUBG или аккаунт CS2"
          aria-label="Поиск по каталогу"
          className="w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus-visible:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:focus-visible:border-neutral-100"
        />
        <select
          value={sort}
          onChange={(e) => push({ sort: e.target.value })}
          aria-label="Сортировка"
          className="border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <option value="new">Сначала новые</option>
          <option value="cheap">Сначала дешёвые</option>
          <option value="expensive">Сначала дорогие</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Игра">
        <FilterChip active={!game} onClick={() => push({ game: null })}>Все игры</FilterChip>
        {GAMES.map((g) => (
          <FilterChip key={g.slug} active={game === g.slug} onClick={() => push({ game: g.slug })}>
            <span aria-hidden="true" className="mr-1">{g.glyph}</span>
            {g.title}
          </FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Категория">
        <FilterChip active={!category} onClick={() => push({ category: null })}>Все категории</FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c.slug} active={category === c.slug} onClick={() => push({ category: c.slug })}>
            {c.title}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
          : 'border-neutral-200 text-neutral-600 hover:border-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-100',
      )}
    >
      {children}
    </button>
  );
}
