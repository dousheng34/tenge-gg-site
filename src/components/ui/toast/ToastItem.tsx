'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/cn';
import type { Toast, ToastVariant } from './types';

const VARIANT_STYLES: Record<ToastVariant, { accent: string; glyph: string; role: 'status' | 'alert' }> = {
  success: { accent: 'bg-emerald-500', glyph: '✓', role: 'status' },
  error: { accent: 'bg-red-500', glyph: '✕', role: 'alert' },
  info: { accent: 'bg-neutral-900 dark:bg-white', glyph: 'i', role: 'status' },
};

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  /** Пауза таймера, пока пользователь взаимодействует со стеком. */
  paused: boolean;
}

export const ToastItem = memo(function ToastItem({ toast, onDismiss, paused }: ToastItemProps) {
  const reduceMotion = useReducedMotion();
  const { accent, glyph, role } = VARIANT_STYLES[toast.variant];

  // Таймер живёт в компоненте: пауза при hover/focus не трогает стор.
  const [remaining, setRemaining] = useState(toast.duration);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!Number.isFinite(toast.duration) || toast.duration <= 0) return;
    if (paused) {
      setRemaining((prev) => Math.max(0, prev - (Date.now() - startedAt.current)));
      return;
    }

    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining);
    return () => window.clearTimeout(timer);
    // remaining намеренно не в зависимостях: пересчёт делает ветка paused
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, toast.id, toast.duration, onDismiss]);

  return (
    <motion.li
      layout={!reduceMotion}
      role={role}
      aria-atomic="true"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.7 }}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 overflow-hidden',
        'border border-neutral-200 bg-white p-3 pr-2 shadow-sm',
        'dark:border-neutral-800 dark:bg-neutral-950',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center text-[11px] font-medium text-white',
          accent,
          toast.variant === 'info' && 'text-white dark:text-neutral-900',
        )}
      >
        {glyph}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium tracking-tight text-neutral-900 dark:text-neutral-50">
          {toast.title}
        </p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            {toast.description}
          </p>
        ) : null}

        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-xs font-medium text-neutral-900 underline underline-offset-4 hover:opacity-70 dark:text-neutral-50"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Закрыть уведомление"
        className={cn(
          'grid size-6 shrink-0 place-items-center text-neutral-400 transition-colors',
          'hover:text-neutral-900 focus-visible:outline focus-visible:outline-2',
          'focus-visible:outline-offset-2 focus-visible:outline-neutral-900',
          'dark:hover:text-neutral-50 dark:focus-visible:outline-neutral-100',
        )}
      >
        <span aria-hidden="true" className="text-sm leading-none">
          ✕
        </span>
      </button>
    </motion.li>
  );
});
