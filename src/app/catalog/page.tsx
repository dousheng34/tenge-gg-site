import type { Metadata } from 'next';
import Link from 'next/link';

import { CatalogFilters } from '@/components/catalog/CatalogFilters';
import { LotCard } from '@/components/catalog/LotCard';
import { getCatalog, type CatalogFilters as Filters } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'Каталог лотов',
  description: 'Донат, аккаунты, валюта и предметы с escrow-защитой и оплатой Kaspi QR.',
};

export const revalidate = 30;

type Search = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const sortRaw = one(sp.sort);
  const filters: Filters = {
    game: one(sp.game),
    category: one(sp.category),
    q: one(sp.q),
    sort: sortRaw === 'cheap' || sortRaw === 'expensive' ? sortRaw : 'new',
    page: Number.parseInt(one(sp.page) ?? '1', 10) || 1,
  };

  const { items, total, page, pageSize } = await getCatalog(filters);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const qs = (next: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== 'page') params.set(k, String(v));
    params.set('page', String(next));
    return `/catalog?${params.toString()}`;
  };

  return (
    <div className="section py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Каталог</h1>
          <p className="num mt-1 text-xs text-neutral-500">
            {total} {total === 1 ? 'лот' : 'лотов'} · escrow на каждой сделке
          </p>
        </div>
        <Link href="/sell" className="border border-neutral-900 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] dark:border-neutral-100">
          Выставить лот
        </Link>
      </div>

      <CatalogFilters />

      {items.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center gap-2 p-12 text-center">
          <span aria-hidden="true" className="text-3xl opacity-20">空</span>
          <p className="text-sm">Ничего не нашлось. Смягчите фильтры или загляните позже.</p>
          <Link href="/catalog" className="text-xs underline underline-offset-4">Сбросить фильтры</Link>
        </div>
      ) : (
        <ul className="defer-paint mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((lot) => (
            <li key={lot.id}>
              <LotCard lot={lot} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Страницы каталога" className="mt-8 flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={qs(page - 1)} className="border border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-800">
              ← Назад
            </Link>
          ) : null}
          <span className="num text-xs text-neutral-500">{page} / {pages}</span>
          {page < pages ? (
            <Link href={qs(page + 1)} className="border border-neutral-200 px-3 py-1.5 text-xs dark:border-neutral-800">
              Вперёд →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
