'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/toast';
import { gameTitle, kzt, timeAgo } from '@/lib/format';
import { moderateListingAction } from '@/app/actions/admin';
import { LISTING_STATUS_LABELS, type ListingStatus } from '@/lib/validation/profile.schema';

export interface ModerationRowProps {
  id: string;
  title: string;
  price: number;
  game: string;
  status: string;
  sellerName: string | null;
  createdAt: string;
}

/** Строка модерации лота: публикация или скрытие из каталога. */
export function ModerationRow({ id, title, price, game, status, sellerName, createdAt }: ModerationRowProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);

  const shown = optimistic ?? status;

  const change = (next: ListingStatus) => {
    setOptimistic(next);
    startTransition(async () => {
      const res = await moderateListingAction(id, next);
      if (!res.ok) {
        setOptimistic(null);
        toast.error('Действие отклонено', { description: res.message });
        return;
      }
      toast.success(res.message ?? 'Готово');
      router.refresh();
    });
  };

  return (
    <li className="card flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <Link href={`/lot/${id}`} className="truncate text-sm font-medium underline-offset-4 hover:underline">
          {title}
        </Link>
        <p className="num mt-0.5 truncate text-xs text-neutral-500">
          {sellerName ?? 'без продавца'} · {gameTitle(game)} · {timeAgo(createdAt)}
        </p>
      </div>

      <span className="num text-xs text-neutral-500">
        {LISTING_STATUS_LABELS[shown as ListingStatus] ?? shown}
      </span>
      <span className="num w-24 text-right text-sm font-medium">{kzt(price)}</span>

      <div className="flex gap-2">
        {shown !== 'active' ? (
          <Button onClick={() => change('active')} loading={pending}>
            Опубликовать
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => change('paused')} loading={pending}>
            Скрыть
          </Button>
        )}
      </div>
    </li>
  );
}
