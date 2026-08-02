import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/lib/escrow/state-machine';

const MAP: Record<string, { label: string; className: string }> = {
  CREATED:         { label: 'Создан',            className: 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400' },
  PENDING_PAYMENT: { label: 'Ожидает оплаты',    className: 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  ESCROW_HOLD:     { label: 'Деньги на escrow',  className: 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  VERIFYING:       { label: 'Проверка',          className: 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400' },
  DISPUTE:         { label: 'Спор',              className: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  COMPLETED:       { label: 'Завершён',          className: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  REFUNDED:        { label: 'Возврат',           className: 'border-neutral-400 bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
  CANCELLED:       { label: 'Отменён',           className: 'border-neutral-300 text-neutral-500 dark:border-neutral-700' },
  EXPIRED:         { label: 'Просрочен',         className: 'border-neutral-300 text-neutral-500 dark:border-neutral-700' },
};

export function StatusBadge({ status, className }: { status: OrderStatus | string; className?: string }) {
  const meta = MAP[status] ?? { label: String(status), className: 'border-neutral-300 text-neutral-600' };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]',
        meta.className,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
