import type { Metadata } from 'next';
import Link from 'next/link';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { kzt, timeAgo } from '@/lib/format';
import { getMyOrders, type Order } from '@/lib/queries';

export const metadata: Metadata = { title: 'Мои сделки' };
export const dynamic = 'force-dynamic';

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) === 'sales' ? 'sales' : 'purchases';
  const orders = await getMyOrders(tab === 'sales' ? 'seller' : 'buyer');

  return (
    <div className="section py-8">
      <h1 className="font-display text-2xl tracking-tight">Мои сделки</h1>

      <div role="tablist" aria-label="Тип сделок" className="mt-4 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        <TabLink href="/orders?tab=purchases" active={tab === 'purchases'}>Покупки</TabLink>
        <TabLink href="/orders?tab=sales" active={tab === 'sales'}>Продажи</TabLink>
      </div>

      {orders.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-2 p-12 text-center">
          <span aria-hidden="true" className="text-3xl opacity-20">空</span>
          <p className="text-sm">{tab === 'sales' ? 'Продаж пока нет.' : 'Покупок пока нет.'}</p>
          <Link href={tab === 'sales' ? '/sell' : '/catalog'} className="text-xs underline underline-offset-4">
            {tab === 'sales' ? 'Выставить лот →' : 'Открыть каталог →'}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {orders.map((order: Order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="card flex items-center gap-4 p-4 transition-colors hover:border-neutral-900 dark:hover:border-neutral-100"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{order.listing_title ?? 'Лот'}</p>
                  <p className="num mt-0.5 text-xs text-neutral-500">
                    #{order.id.slice(0, 8)} · {timeAgo(order.created_at)}
                    {tab === 'sales' ? ` · ${order.buyer_name ?? 'покупатель'}` : ` · ${order.seller_name ?? 'продавец'}`}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-medium">
                  {kzt(tab === 'sales' ? Number(order.escrow_amount) - Number(order.fee_amount) : order.escrow_amount)}
                </span>
                <StatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={
        active
          ? '-mb-px border-b-2 border-neutral-900 px-3 py-2 text-xs uppercase tracking-[0.08em] dark:border-neutral-100'
          : 'px-3 py-2 text-xs uppercase tracking-[0.08em] text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50'
      }
    >
      {children}
    </Link>
  );
}
