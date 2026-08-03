'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { kzt, gameTitle, timeAgo } from '@/lib/format';
import { setMyListingStatusAction } from '@/app/actions/profile';
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/validation/profile.schema';

export interface MyListingCardProps {
  id: string;
  title: string;
  price: number;
  game: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
  paused: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  removed: 'border-neutral-300 text-neutral-500 dark:border-neutral-700',
};

/** Карточка своего лота: снять с продажи, вернуть, удалить (мягко). */
export function MyListingCard({ id, title, price, game, status, createdAt }: MyListingCardProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shown = optimistic ?? status;

  const change = (next: ListingStatus) => {
    setOptimistic(next);
    startTransition(async () => {
      const res = await setMyListingStatusAction(id, next);
      if (!res.ok) {
        setOptimistic(null);
        toast.error('Не удалось изменить лот', { description: res.message });
        return;
      }
      toast.success(res.message ?? 'Готово');
      router.refresh();
    });
  };

  return (
    <>
      <li className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <Link href={`/lot/${id}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">
            {title}
          </Link>
          <p className="num mt-0.5 text-xs text-neutral-500">
            {gameTitle(game)} · {timeAgo(createdAt)}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
            STATUS_STYLES[shown] ?? STATUS_STYLES.removed
          }`}
        >
          {LISTING_STATUS_LABELS[shown as ListingStatus] ?? shown}
        </span>

        <span className="num w-28 text-right text-sm font-medium">{kzt(price)}</span>

        <div className="flex gap-2">
          {shown === 'active' ? (
            <Button variant="secondary" onClick={() => change('paused')} loading={pending}>
              Снять
            </Button>
          ) : null}

          {shown === 'paused' ? (
            <Button onClick={() => change('active')} loading={pending}>
              В продажу
            </Button>
          ) : null}

          {shown !== 'removed' ? (
            <Button variant="ghost" onClick={() => setConfirmOpen(true)} disabled={pending}>
              Удалить
            </Button>
          ) : null}
        </div>
      </li>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Удалить лот?"
        description="Лот исчезнет из каталога. История сделок по нему сохранится."
        destructive
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                change('removed');
              }}
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
      </Modal>
    </>
  );
}
