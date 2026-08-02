import Link from 'next/link';

import { LotCard } from '@/components/catalog/LotCard';
import { GAMES, kzt, timeAgo } from '@/lib/format';
import { getCatalog, getMarketStats, getSalesFeed } from '@/lib/queries';

export const revalidate = 60;

const TRUST = [
  { title: 'Escrow-счёт ТОО', text: 'Деньги замораживаются до подтверждения покупателем.' },
  { title: 'Kaspi QR', text: 'Оплата в один скан, зачисление подтверждает вебхук банка.' },
  { title: 'Арбитраж 24/7', text: 'Спор замораживает выплату — решает арбитр, а не продавец.' },
  { title: 'Комиссия 5%', text: 'Без скрытых списаний: сумма к выплате видна до сделки.' },
];

export default async function HomePage() {
  const [{ items }, stats, feed] = await Promise.all([
    getCatalog({ sort: 'new', page: 1 }),
    getMarketStats(),
    getSalesFeed(6),
  ]);

  return (
    <>
      <section className="section pb-10 pt-14 sm:pt-20">
        <p className="label">Игровой маркетплейс Казахстана</p>
        <h1 className="font-display mt-3 max-w-3xl text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Донат, аккаунты и валюта — <span className="text-[rgb(var(--accent))]">без риска</span> потерять деньги
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Платите через Kaspi QR. Сумма держится на транзитном счёте ТОО, пока вы не проверите товар.
          Не подошло — арбитраж вернёт деньги.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href="/catalog" className="bg-neutral-900 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.08em] text-white dark:bg-neutral-100 dark:text-neutral-900">
            Открыть каталог
          </Link>
          <Link href="/sell" className="border border-neutral-200 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.08em] dark:border-neutral-800">
            Продать лот
          </Link>
          <span className="num text-xs text-neutral-400">
            {stats.lots} активных лотов · {stats.deals} закрытых сделок
          </span>
        </div>
      </section>

      <section className="section" aria-label="Гарантии">
        <ul className="grid grid-cols-1 gap-px border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-800">
          {TRUST.map((t) => (
            <li key={t.title} className="bg-[rgb(var(--bg))] p-5">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{t.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section mt-14" aria-label="Игры">
        <h2 className="label">Популярные игры</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/catalog?game=${g.slug}`}
                className="flex items-center gap-2 border border-neutral-200 px-3 py-2 text-xs transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
              >
                <span aria-hidden="true">{g.glyph}</span>
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section mt-14">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl tracking-tight">Свежие лоты</h2>
          <Link href="/catalog" className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50">
            Весь каталог →
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="card mt-4 p-8 text-center text-sm text-neutral-500">
            Лотов пока нет — станьте первым продавцом.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.slice(0, 8).map((lot) => (
              <li key={lot.id}><LotCard lot={lot} /></li>
            ))}
          </ul>
        )}
      </section>

      {feed.length > 0 ? (
        <section className="section mt-14" aria-label="Последние сделки">
          <h2 className="label">Последние сделки</h2>
          <ul className="mt-3 divide-y divide-neutral-200 border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {feed.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
                <span className="min-w-0 flex-1 truncate">{s.title ?? 'Лот'}</span>
                <span className="hidden text-neutral-400 sm:inline">{s.buyer_name ?? 'Покупатель'}</span>
                <span className="num shrink-0 font-medium">{kzt(s.amount)}</span>
                <span className="shrink-0 text-neutral-400">{timeAgo(s.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
