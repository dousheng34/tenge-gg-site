import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ModerationRow } from '@/components/admin/ModerationRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { kzt, timeAgo } from '@/lib/format';
import { getAdminOverview, getAllListings, getAllOrders, getLeads, isStaff } from '@/lib/admin.queries';

export const metadata: Metadata = { title: 'Панель' };
export const dynamic = 'force-dynamic';

/**
 * Панель сотрудника. Роль берётся из is_staff() в базе — той же функции, что и в политиках RLS.
 * Статусы сделок здесь не редактируются: для этого есть escrow-стейт-машина и /arbitration.
 */
export default async function AdminPage() {
  if (!(await isStaff())) notFound();

  const [overview, listings, orders, leads] = await Promise.all([
    getAdminOverview(),
    getAllListings(),
    getAllOrders(),
    getLeads(),
  ]);

  return (
    <div className="section flex flex-col gap-10 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-tight">Панель</h1>
          <p className="mt-1 text-xs text-neutral-500">Модерация каталога, заявки и метрики маркетплейса.</p>
        </div>
        <Link
          href="/arbitration"
          className="border border-neutral-900 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] dark:border-neutral-100"
        >
          Арбитраж{overview.disputes > 0 ? ` · ${overview.disputes}` : ''}
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
        <Metric label="Лотов в продаже" value={overview.activeListings} />
        <Metric label="Сделок всего" value={overview.orders} />
        <Metric label="Завершено" value={overview.completed} />
        <Metric label="Споров" value={overview.disputes} accent={overview.disputes > 0} />
        <Metric label="Оборот" value={kzt(overview.gmv)} />
        <Metric label="Заявок" value={overview.leads} />
      </dl>

      <section aria-labelledby="admin-listings">
        <h2 id="admin-listings" className="font-display text-lg tracking-tight">
          Каталог
        </h2>
        <p className="mt-1 text-xs text-neutral-500">Последние {listings.length} лотов.</p>

        <ul className="mt-4 flex flex-col gap-2">
          {listings.map((listing) => (
            <ModerationRow
              key={listing.id}
              id={listing.id}
              title={listing.title}
              price={listing.price}
              game={listing.game_type}
              status={listing.status}
              sellerName={listing.seller_name}
              createdAt={listing.created_at}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-orders">
        <h2 id="admin-orders" className="font-display text-lg tracking-tight">
          Сделки
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Только чтение. Статус меняется через escrow-переходы, вручную — нельзя.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="card flex flex-wrap items-center gap-3 p-3 transition-colors hover:border-neutral-900 dark:hover:border-neutral-100"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{order.listing_title ?? 'Сделка'}</span>
                <StatusBadge status={order.status} />
                <span className="num text-xs text-neutral-500">{timeAgo(order.created_at)}</span>
                <span className="num w-24 text-right text-sm font-medium">{kzt(order.escrow_amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="admin-leads">
        <h2 id="admin-leads" className="font-display text-lg tracking-tight">
          Ранние заявки
        </h2>

        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Заявок нет.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {leads.map((lead) => (
              <li key={lead.id} className="card flex items-center justify-between gap-3 p-3">
                <span className="num truncate text-sm">{lead.contact}</span>
                <span className="label shrink-0">{lead.role}</span>
                <span className="num shrink-0 text-xs text-neutral-400">{timeAgo(lead.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-red-500/40' : ''}`}>
      <dt className="label">{label}</dt>
      <dd className="num mt-1 text-lg font-medium tracking-tight">{value}</dd>
    </div>
  );
}
