'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { countdown } from '@/lib/format';
import type { OrderStatus } from '@/lib/escrow/state-machine';

const STEPS: { key: OrderStatus; title: string; text: string }[] = [
  { key: 'PENDING_PAYMENT', title: 'Оплата', text: 'Kaspi QR выпущен, ждём подтверждение банка' },
  { key: 'ESCROW_HOLD', title: 'Escrow', text: 'Деньги на транзитном счёте ТОО' },
  { key: 'VERIFYING', title: 'Передача', text: 'Продавец передал данные, покупатель проверяет' },
  { key: 'COMPLETED', title: 'Выплата', text: 'Сделка закрыта, деньги у продавца' },
];

const INDEX: Record<string, number> = {
  CREATED: 0, PENDING_PAYMENT: 0, ESCROW_HOLD: 1, VERIFYING: 2,
  DISPUTE: 2, COMPLETED: 3, REFUNDED: 3, CANCELLED: 0, EXPIRED: 0,
};

export function EscrowTimeline({ status, autoCompleteAt }: { status: OrderStatus; autoCompleteAt: string | null }) {
  const current = INDEX[status] ?? 0;
  const disputed = status === 'DISPUTE';
  const [left, setLeft] = useState(() => countdown(autoCompleteAt));

  // Тикаем раз в секунду только пока таймер актуален — иначе интервал не создаём.
  useEffect(() => {
    if (!autoCompleteAt || status !== 'VERIFYING') return;
    const id = setInterval(() => setLeft(countdown(autoCompleteAt)), 1000);
    return () => clearInterval(id);
  }, [autoCompleteAt, status]);

  return (
    <section aria-label="Статус сделки" className="card p-4">
      <ol className="flex flex-col gap-0 sm:flex-row sm:gap-2">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.key} className="flex flex-1 gap-3 sm:flex-col sm:gap-2">
              <div className="flex items-center gap-2 sm:w-full">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                    done && 'border-emerald-500 bg-emerald-500 text-white',
                    active && !disputed && 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900',
                    active && disputed && 'border-red-500 bg-red-500 text-white',
                    !done && !active && 'border-neutral-300 text-neutral-400 dark:border-neutral-700',
                  )}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className="hidden h-px flex-1 bg-neutral-200 sm:block dark:bg-neutral-800" />
              </div>
              <div className="pb-4 sm:pb-0">
                <p className={cn('text-xs font-medium', !done && !active && 'text-neutral-400')}>{step.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {disputed ? (
        <p role="status" className="mt-3 border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
          Открыт спор — выплата заморожена до решения арбитра.
        </p>
      ) : null}

      {status === 'VERIFYING' && left && !left.done ? (
        <p role="status" className="num mt-3 border border-neutral-200 p-2 text-xs text-neutral-500 dark:border-neutral-800">
          Авто-подтверждение через{' '}
          <b className="text-neutral-900 dark:text-neutral-50">
            {String(left.h).padStart(2, '0')}:{String(left.m).padStart(2, '0')}:{String(left.s).padStart(2, '0')}
          </b>{' '}
          — после этого деньги уйдут продавцу автоматически.
        </p>
      ) : null}
    </section>
  );
}
