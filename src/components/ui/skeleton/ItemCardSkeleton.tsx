import { memo } from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface ItemCardSkeletonProps {
  className?: string;
}

/**
 * Скелет карточки лота. Геометрия 1:1 с боевой карточкой каталога
 * (обложка 4:3 → бейдж игры → заголовок в 2 строки → продавец → цена),
 * чтобы при подмене контента не было layout shift (CLS ≈ 0).
 */
export const ItemCardSkeleton = memo(function ItemCardSkeleton({ className }: ItemCardSkeletonProps) {
  return (
    <article
      aria-hidden="true"
      className={cn(
        'flex flex-col overflow-hidden border border-neutral-200 bg-white',
        'dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
    >
      {/* Обложка 4:3 */}
      <Skeleton radius="none" className="aspect-[4/3] w-full" />

      <div className="flex flex-1 flex-col gap-3 p-3">
        {/* Бейдж игры + категория */}
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>

        {/* Заголовок: две строки, вторая короче */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>

        {/* Продавец */}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Skeleton radius="full" className="size-6 shrink-0" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="ml-auto h-3 w-8" />
        </div>

        {/* Цена + CTA */}
        <div className="flex items-end justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </article>
  );
});

export interface ItemCardSkeletonGridProps {
  /** Сколько карточек-заглушек отрисовать. */
  count?: number;
  className?: string;
  /** Текст для скринридеров, объявляется один раз на всю сетку. */
  label?: string;
}

/**
 * Сетка скелетов. Единственный live-region на весь список:
 * `role="status"` + `aria-busy` вместо N объявлений.
 */
export function ItemCardSkeletonGrid({
  count = 8,
  className,
  label = 'Загружаем лоты',
}: ItemCardSkeletonGridProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <ItemCardSkeleton key={index} />
      ))}
    </div>
  );
}
