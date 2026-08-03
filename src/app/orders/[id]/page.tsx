import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { DealChat } from '@/components/orders/DealChat';
import { EscrowTimeline } from '@/components/orders/EscrowTimeline';
import { OrderActions } from '@/components/orders/OrderActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { kzt, timeAgo } from '@/lib/format';
import { actorFor, normalizeStatus, type EscrowActor } from '@/lib/escrow/state-machine';
import { getCurrentUser, getOrder, getOrderMessages } from '@/lib/queries';
import { createUserClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Сделка' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export default async function OrderPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?next=/orders/${id}`);

  const order = await getOrder(id);
  if (!order) notFound();

  const supabase = await createUserClient();
  const { data: roleRow } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  const isArbiter = roleRow?.role === 'arbiter' || roleRow?.role === 'admin';

  const role: EscrowActor | null = actorFor(user.id, order, { isArbiter });
  if (!role) notFound();

  const messages = await getOrderMessages(id);
  const status = normalizeStatus(order.status);
  const payout = Number(order.escrow_amount) - Number(order.fee_amount);

  return (
    <div className="section grid gap-6 py-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl tracking-tight sm:text-2xl">{order.listing_title ?? 'Сделка'}</h1>
            <p className="num mt-1 text-xs text-neutral-500">
              #{order.id.slice(0, 8)} · создана {timeAgo(order.created_at)} · версия {order.version}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </header>

        <EscrowTimeline status={status} autoCompleteAt={order.auto_complete_at} />

        <section className="card grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4 dark:bg-neutral-800">
          <Cell label="Сумма" value={kzt(order.escrow_amount)} />
          <Cell label="Комиссия 5%" value={kzt(order.fee_amount)} />
          <Cell label="К выплате" value={kzt(payout)} />
          <Cell label="Ваша роль" value={role === 'BUYER' ? 'Покупатель' : role === 'SELLER' ? 'Продавец' : 'Арбитр'} />
        </section>

        <section aria-label="Действия" className="card p-4">
          <h2 className="label mb-3">Что можно сделать</h2>
          <OrderActions orderId={order.id} status={status} version={order.version} role={role} />
        </section>

        {order.dispute_reason ? (
          <section className="card border-red-500/40 p-4">
            <h2 className="label text-red-600 dark:text-red-400">Причина спора</h2>
            <p className="mt-2 text-sm leading-relaxed">{order.dispute_reason}</p>
          </section>
        ) : null}
      </div>

      <aside>
        <DealChat orderId={order.id} me={user.id} initial={messages} />
      </aside>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[rgb(var(--bg))] p-3">
      <p className="label">{label}</p>
      <p className="num mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
