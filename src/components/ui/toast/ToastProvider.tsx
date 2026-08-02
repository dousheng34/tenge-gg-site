'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';

import { ToastContext } from './toast-context';
import { ToastItem } from './ToastItem';
import type { Toast, ToastApi, ToastOptions, ToastVariant } from './types';

const DEFAULT_DURATION = 3000;
const MAX_VISIBLE = 4;

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Максимум одновременно видимых тостов, старые вытесняются. */
  limit?: number;
  duration?: number;
}

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `toast_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Провайдер тостов.
 *
 * Производительность: в контекст уходит только мемоизированный API
 * со стабильными ссылками, поэтому дерево-потребитель не ререндерится
 * при каждом новом уведомлении — перерисовывается лишь viewport.
 *
 * a11y: viewport — `aria-live` регион вне потока документа; `success`/`info`
 * объявляются как `status` (polite), `error` — как `alert` (assertive).
 * Наведение/фокус ставят автозакрытие на паузу (WCAG 2.2.1).
 */
export function ToastProvider({ children, limit = MAX_VISIBLE, duration = DEFAULT_DURATION }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Портал монтируется только на клиенте: SSR-разметка остаётся чистой.
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const push = useCallback(
    (variant: ToastVariant, title: string, options?: ToastOptions): string => {
      const id = options?.id ?? createId();

      setToasts((prev) => {
        const next: Toast = {
          id,
          variant,
          title,
          description: options?.description,
          duration: options?.duration ?? duration,
          action: options?.action,
          createdAt: Date.now(),
        };

        const existing = prev.findIndex((toast) => toast.id === id);
        if (existing !== -1) {
          const copy = [...prev];
          copy[existing] = next;
          return copy;
        }

        return [...prev, next].slice(-limit);
      });

      return id;
    },
    [duration, limit],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
      dismissAll,
    }),
    [push, dismiss, dismissAll],
  );

  const viewport = (
    <div
      // Контейнер не перехватывает клики по странице.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-end p-3 sm:p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ol
        aria-live="polite"
        aria-relevant="additions text"
        tabIndex={-1}
        className="flex w-full max-w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} paused={paused} />
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted ? createPortal(viewport, document.body) : null}
    </ToastContext.Provider>
  );
}
