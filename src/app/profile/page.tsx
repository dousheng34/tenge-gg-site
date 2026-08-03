import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { MyListingCard } from '@/components/profile/MyListingCard';
import { ReviewPrompt } from '@/components/profile/ReviewPrompt';
import { SellerProfileForm } from '@/components/profile/SellerProfileForm';
import { initials, timeAgo } from '@/lib/format';
import {
  getMyListings,
  getMyProfileStats,
  getMySellerProfile,
  getOrdersAwaitingMyReview,
  getReviewsAboutMe,
} from '@/lib/profile.queries';
import { getCurrentUser } from '@/lib/queries';

export const metadata: Metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth?next=/profile');

  const [seller, listings, reviews, awaiting, stats] = await Promise.all([
    getMySellerProfile(),
    getMyListings(),
    getReviewsAboutMe(),
    getOrdersAwaitingMyReview(),
    getMyProfileStats(),
  ]);

  const displayName = seller?.nickname ?? user.email?.split('@')[0] ?? 'Профиль';
  const visibleListings = listings.filter((l) => l.status !== 'removed');

  return (
    <div className="section flex flex-col gap-10 py-8">
      <header className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {initials(displayName)}
        </span>

        <div className="min-w-0">
          <h1 className="font-display truncate text-2xl tracking-tight">{displayName}</h1>
          <p className="num mt-1 text-xs text-neutral-500">
            {seller?.verified ? 'Проверенный продавец · ' : ''}
            {seller?.city ?? 'Город не указан'} · с {timeAgo(seller?.created_at ?? null)}
          </p>
        </div>

        <dl className="ml-auto grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat label="Лотов" value={stats.activeListings} />
          <Stat label="Продаж" value={stats.sales} />
          <Stat label="Покупок" value={stats.purchases} />
          <Stat
            label="Рейтинг"
            value={stats.rating === null ? '—' : `${stats.rating.toFixed(1)} (${stats.reviews})`}
          />
        </dl>
      </header>

      <section aria-labelledby="profile-settings" className="card p-5">
        <h2 id="profile-settings" className="label">
          Данные продавца
        </h2>
        <div className="mt-4">
          <SellerProfileForm
            nickname={seller?.nickname ?? ''}
            city={seller?.city ?? ''}
            email={user.email ?? null}
          />
        </div>
      </section>

      {awaiting.length > 0 ? (
        <section aria-labelledby="profile-awaiting">
          <h2 id="profile-awaiting" className="font-display text-lg tracking-tight">
            Оцените завершённые сделки
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Отзыв можно оставить один раз по своей завершённой покупке.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {awaiting.map((order) => (
              <ReviewPrompt
                key={order.id}
                orderId={order.id}
                title={order.listing_title ?? 'Сделка'}
                amount={order.escrow_amount}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="profile-listings">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="profile-listings" className="font-display text-lg tracking-tight">
            Мои лоты
          </h2>
          <Link href="/sell" className="text-xs underline underline-offset-4">
            Выставить лот
          </Link>
        </div>

        {visibleListings.length === 0 ? (
          <div className="card mt-4 p-10 text-center">
            <span aria-hidden="true" className="text-3xl opacity-20">
              空
            </span>
            <p className="mt-2 text-sm">Активных лотов нет.</p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {visibleListings.map((listing) => (
              <MyListingCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                price={listing.price}
                game={listing.game_type}
                status={listing.status}
                createdAt={listing.created_at}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile-reviews">
        <h2 id="profile-reviews" className="font-display text-lg tracking-tight">
          Отзывы обо мне
        </h2>

        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Отзывов пока нет.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{review.author_name}</p>
                  <p aria-label={`${review.rating} из 5`} className="shrink-0 text-xs">
                    {'★'.repeat(review.rating)}
                    <span className="opacity-25">{'★'.repeat(Math.max(0, 5 - review.rating))}</span>
                  </p>
                </div>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{review.text}</p>
                <p className="num mt-2 text-[11px] text-neutral-400">
                  {review.subject ?? 'Сделка'} · {timeAgo(review.created_at)}
                  {review.had_dispute ? ' · был спор' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}
