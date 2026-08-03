'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { fee, kzt } from '@/lib/format';
import { startOrderAction } from '@/app/actions/listings';

export interface BuyPanelProps {
  listingId: string;
  price: number;
  title: string;
  authenticated: boolean;
}

/**
 * Покупка в два шага: заказ создаётся на сервере (RPC escrow_create_order),
 * затем показывается Kaspi QR. Ключ идемпотентности не даёт создать
 * два заказа двойным кликом или ретраем.
 */
export function BuyPanel({ listingId, price, title, authenticated }: BuyPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const commission = fee(price);

  const start = async () => {
    if (!authenticated) {
      router.push(`/auth?next=/lot/${listingId}`);
      return;
    }

    setPending(true);
    const key = `buy:${listingId}:${Date.now().toString(36)}`;
    const res = await startOrderAction(listingId, key);
    setPending(false);

    if (!res.ok) {
      toast.error('Сделка не создана', { description: res.message });
      return;
    }

    setOrderId(res.orderId ?? null);
    setOpen(true);
  };

  return (
    <>
      <div className="card sticky top-20 flex flex-col gap-4 p-4">
        <div>
          <p className="label">К оплате</p>
          <p className="num mt-1 text-3xl font-medium tracking-tight">{kzt(price)}</p>
          <p className="num mt-1 text-xs text-neutral-500">
            Комиссия сервиса {kzt(commission)} уже включена
          </p>
        </div>

        <Button onClick={start} loading={pending} className="h-11 w-full">
          Купить через Kaspi QR
        </Button>

        <ol className="flex flex-col gap-2 border-t border-neutral-200 pt-4 text-xs text-neutral-500 dark:border-neutral-800">
          <li>1 — оплачиваете QR, деньги уходят на escrow-счёт ТОО</li>
          <li>2 — продавец передаёт данные в чате сделки</li>
          <li>3 — проверяете и подтверждаете, продавец получает выплату</li>
          <li>4 — что-то не так — открываете спор, деньги заморожены</li>
        </ol>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Оплата Kaspi QR"
        description={`${title} · ${kzt(price)}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Позже</Button>
            <Button onClick={() => orderId && router.push(`/orders/${orderId}`)}>Перейти к сделке</Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="grid size-40 place-items-center border border-neutral-200 bg-white text-[10px] uppercase tracking-[0.08em] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950"
          >
            Kaspi QR
          </div>
          <p className="text-center text-xs leading-relaxed text-neutral-500">
            Отсканируйте QR в приложении Kaspi. Статус сделки обновится автоматически,
            как только банк подтвердит платёж — обновлять страницу не нужно.
          </p>
          {orderId ? <p className="num text-[10px] text-neutral-400">Заказ #{orderId.slice(0, 8)}</p> : null}
        </div>
      </Modal>
    </>
  );
}
