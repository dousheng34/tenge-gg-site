'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/cn';
import { useFocusTrap } from './use-focus-trap';
import { useScrollLock } from './use-scroll-lock';

export type ModalSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Диалог требует явного решения — оверлей и ESC не закрывают. */
  dismissible?: boolean;
  /** Критичное действие: role="alertdialog" вместо "dialog". */
  destructive?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * Модальное окно.
 *
 * UX: закрытие по оверлею и ESC, блокировка скролла body, возврат фокуса,
 * ловушка Tab, `prefers-reduced-motion`.
 *
 * a11y: `role="dialog" aria-modal="true"`, связка с заголовком и описанием
 * через aria-labelledby / aria-describedby, фон помечен `aria-hidden`
 * неявно — фокус физически не может выйти за пределы контейнера.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  destructive = false,
  initialFocusRef,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pointerDownOnOverlay = useRef(false);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const id = useId();

  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => setMounted(true), []);
  useScrollLock(open);
  useFocusTrap(panelRef, open, initialFocusRef);

  const requestClose = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  // ESC перехватывается на capture-фазе: закрывается только верхняя модалка.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        requestClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, requestClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
          {/* Оверлей: клик засчитывается, только если и pointerdown, и pointerup
              произошли на нём — выделение текста внутри панели не закрывает окно. */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
            onPointerDown={(event) => {
              pointerDownOnOverlay.current = event.target === event.currentTarget;
            }}
            onPointerUp={(event) => {
              if (pointerDownOnOverlay.current && event.target === event.currentTarget) requestClose();
              pointerDownOnOverlay.current = false;
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            ref={panelRef}
            role={destructive ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 w-full origin-center border border-neutral-200 bg-white',
              'shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950',
              'max-h-[90dvh] overflow-y-auto',
              SIZES[size],
              className,
            )}
          >
            <header className="flex items-start gap-4 border-b border-neutral-200 p-4 dark:border-neutral-800">
              <div className="min-w-0 flex-1">
                <h2
                  id={titleId}
                  className="text-sm font-medium uppercase tracking-[0.08em] text-neutral-900 dark:text-neutral-50"
                >
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {description}
                  </p>
                ) : null}
              </div>

              {dismissible ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрыть окно"
                  className={cn(
                    'grid size-7 shrink-0 place-items-center border border-neutral-200 text-neutral-500',
                    'transition-colors hover:border-neutral-900 hover:text-neutral-900',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                    'focus-visible:outline-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100',
                    'dark:hover:text-neutral-50 dark:focus-visible:outline-neutral-100',
                  )}
                >
                  <span aria-hidden="true" className="text-sm leading-none">
                    ✕
                  </span>
                </button>
              ) : null}
            </header>

            {children ? <div className="p-4">{children}</div> : null}

            {footer ? (
              <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
