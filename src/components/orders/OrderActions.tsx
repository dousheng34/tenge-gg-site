'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/modal';
import { Field, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { allowedTransitions, type EscrowActor, type OrderStatus } from '@/lib/escrow/state-machine';
import { confirmOrderAction, markDeliveredAction, openDisputeAction, resolveDisputeAction } from '@/app/actions/orders';

export interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
  version: number;
  role: EscrowActor;
}

/**
 * Действия участника сделки.
 *
 * Набор кнопок вычисляется из того же графа переходов, что и в БД, —
 * пользователь физически не видит действия, которое сервер отклонит.
 * UI оптимистичный: статус меняется сразу, при ошибке откатывается.
 */
export function OrderActions({ orderId, status, version, role }: OrderActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<OrderStatus | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');

  const shown = optimistic ?? status;
  const can = (to: OrderStatus) => allowedTransitions(shown, role).includes(to);

  const run = (to: OrderStatus, fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setOptimistic(to);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setOptimistic(null);
        toast.error('Действие отклонено', { description: res.message });
        return;
      }
      toast.success('Готово', { description: res.message });
      router.refresh();
    });
  };

  if (['COMPLETED', 'REFUNDED', 'CANCELLED', 'EXPIRED'].includes(shown)) {
    return <p className="text-xs text-neutral-500">Сделка закрыта. Действий больше нет.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {role === 'SELLER' && can('VERIFYING') ? (
          <Button
            onClick={() => run('VERIFYING', () => markDeliveredAction(orderId, 'Данные переданы в чате', version))}
            loading={pending}
          >
            Данные переданы
          </Button>
        ) : null}

        {role === 'BUYER' && can('COMPLETED') ? (
          <Button
            onClick={() => run('COMPLETED', () => confirmOrderAction(orderId, version))}
            loading={pending}
          >
            Подтвердить получение
          </Button>
        ) : null}

        {can('DISPUTE') ? (
          <Button variant="secondary" onClick={() => setDisputeOpen(true)} disabled={pending}>
            Открыть спор
          </Button>
        ) : null}

        {role === 'ARBITER' && shown === 'DISPUTE' ? (
          <>
            <Button
              variant="secondary"
              onClick={() => run('REFUNDED', () => resolveDisputeAction(orderId, 'REFUNDED', reason || 'Решение в пользу покупателя', version))}
              loading={pending}
            >
              Вернуть покупателю
            </Button>
            <Button
              onClick={() => run('COMPLETED', () => resolveDisputeAction(orderId, 'COMPLETED', reason || 'Решение в пользу продавца', version))}
              loading={pending}
            >
              Выплатить продавцу
            </Button>
          </>
        ) : null}
      </div>

      <Modal
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        title="Открыть спор"
        description="Деньги остаются на escrow-счёте до решения арбитра."
        destructive
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDisputeOpen(false)}>Отмена</Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 10}
              onClick={() => {
                setDisputeOpen(false);
                run('DISPUTE', () => openDisputeAction(orderId, reason, version));
              }}
            >
              Открыть спор
            </Button>
          </>
        }
      >
        <Field
          label="Что пошло не так"
          required
          hint="Минимум 10 символов. Приложите доказательства в чат сделки."
          error={reason.length > 0 && reason.trim().length < 10 ? 'Опишите проблему подробнее' : undefined}
        >
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
        </Field>
      </Modal>
    </>
  );
}
