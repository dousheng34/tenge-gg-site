import Link from 'next/link';

import { cn } from '@/lib/cn';
import { gameGlyph, gameTitle, initials, kzt } from '@/lib/format';
import type { Listing } from '@/lib/queries';

export function LotCard({ lot, className }: { lot: Listing; className?: string }) {
  return (
    <article
      className={cn(
        'group card flex flex-col transition-colors hover:border-neutral-900 dark:hover:border-neutral-100',
        className,
      )}
    >
      <Link href={`/lot/${lot.id}`} className="flex flex-1 flex-col outline-none">
        <div className="relative flex aspect-[4/3] items-center justify-center border-b border-neutral-200 bg-neutral-50 text-5xl dark:border-neutral-800 dark:bg-neutral-900">
          <span aria-hidden="true">{gameGlyph(lot.game_type)}</span>
          <span className="absolute left-2 top-2 border border-neutral-200 bg-white/90 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-neutral-600 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 dark:text-neutral-400">
            {gameTitle(lot.game_type)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 dark:text-neutral-50">
            {lot.title}
          </h3>

          <div className="mt-auto flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-[10px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              {initials(lot.seller_name)}
            </span>
            <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">
              {lot.seller_name ?? 'Продавец'}
            </span>
            {lot.seller_verified ? (
              <span className="ml-auto shrink-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                ✓ проверен
              </span>
            ) : (
              <span className="num ml-auto shrink-0 text-[10px] text-neutral-400">{lot.seller_deals ?? 0} сделок</span>
            )}
          </div>

          <div className="flex items-end justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <span className="num text-base font-medium tracking-tight">{kzt(lot.price)}</span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-neutral-400 transition-colors group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
              Купить →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
