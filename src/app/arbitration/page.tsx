import type { Metadata } from 'next';
import Link from 'next/link';

import { kzt, timeAgo } from '@/lib/format';
import { getDisputeQueue } from '@/lib/queries';

export const metadata: Metadata = { title: 'Арбитраж' };
export const dynamic = 'force-dynamic';

/** RLS отдаёт строки только арбитру/админу — отдельная проверка роли не нужна. */
export default async function ArbitrationPage() {
  const queue = await getDisputeQueue();

  return (
    <div className="section py-8">
      <h1 className="font-display text-2xl tracking-tight">Очередь арбитража</h1>
      <p className="num mt-1 text-xs text-neutral-500">{queue.length} открытых споров</p>

      {queue.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <span aria-hidden="true" className="text-3xl opacity-20">和</span>
          <p className="mt-2 text-sm">Споров нет. Все сделки идут штатно.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {queue.map((row) => (
            <li key={row.id ?? ''}>
              <Link
                href={`/orders/${row.id}`}
                className="card flex flex-wrap items-center gap-4 border-red-500/30 p-4 transition-colors hover:border-red-500"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.listing_title ?? 'Лот'}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{row.dispute_reason}</p>
                </div>
                <span className="num text-xs text-neutral-400">открыт {timeAgo(row.dispute_opened_at)}</span>
                <span className="num text-sm font-medium">{kzt(row.escrow_amount)}</span>
                <span className="num text-xs text-neutral-400">{row.messages ?? 0} сообщ.</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
