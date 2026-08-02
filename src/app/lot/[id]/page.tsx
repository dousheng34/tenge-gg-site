import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BuyPanel } from '@/components/lot/BuyPanel';
import { gameGlyph, gameTitle, initials, kzt, timeAgo } from '@/lib/format';
import { getCurrentUser, getListing, getSeller, getSellerReviews } from '@/lib/queries';

export const revalidate = 30;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const lot = await getListing(id);
  if (!lot) return { title: 'Лот не найден' };
  return {
    title: lot.title,
    description: lot.description?.slice(0, 160) ?? `${gameTitle(lot.game_type)} · ${kzt(lot.price)} с escrow-защитой`,
  };
}

export default async function LotPage({ params }: { params: Params }) {
  const { id } = await params;
  const [lot, user] = await Promise.all([getListing(id), getCurrentUser()]);
  if (!lot || lot.status !== 'active') notFound();

  const [seller, reviews] = await Promise.all([getSeller(lot.seller_id), getSellerReviews(lot.seller_id, 3)]);

  return (
    <div className="section grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <nav aria-label="Хлебные крошки" className="text-xs text-neutral-500">
          <Link href="/catalog" className="hover:text-neutral-900 dark:hover:text-neutral-50">Каталог</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/catalog?game=${lot.game_type}`} className="hover:text-neutral-900 dark:hover:text-neutral-50">
            {gameTitle(lot.game_type)}
          </Link>
        </nav>

        <div className="card flex aspect-[16/7] items-center justify-center text-6xl">
          <span aria-hidden="true">{gameGlyph(lot.game_type)}</span>
        </div>

        <div>
          <h1 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">{lot.title}</h1>
          <p className="num mt-2 text-xs text-neutral-500">
            {gameTitle(lot.game_type)} · опубликован {timeAgo(lot.created_at)}
          </p>
        </div>

        <section aria-labelledby="descr">
          <h2 id="descr" className="label">Описание</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {lot.description?.trim() || 'Продавец не добавил описание.'}
          </p>
        </section>

        <section aria-labelledby="seller" className="card p-4">
          <h2 id="seller" className="label">Продавец</h2>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {initials(lot.seller_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{lot.seller_name ?? 'Продавец KZ'}</p>
              <p className="num text-xs text-neutral-500">
                {lot.seller_verified ? '✓ проверен · ' : ''}
                {seller?.deals ?? lot.seller_deals ?? 0} сделок
                {seller?.rating ? ` · ★ ${Number(seller.rating).toFixed(2)}` : ''}
              </p>
            </div>
          </div>

          {reviews.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
              {reviews.map((r) => (
                <li key={r.id} className="text-xs">
                  <p className="num font-medium">★ {r.rating}/5 · {r.author_name}</p>
                  <p className="mt-1 leading-relaxed text-neutral-500 dark:text-neutral-400">{r.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <aside>
        <BuyPanel listingId={lot.id} price={Number(lot.price)} title={lot.title} authenticated={Boolean(user)} />
      </aside>
    </div>
  );
}
