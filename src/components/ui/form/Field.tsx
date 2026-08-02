'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface FieldContextValue {
  inputId: string;
  errorId: string;
  hintId: string;
  hasError: boolean;
  hasHint: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('Поля формы должны находиться внутри <Field>');
  return ctx;
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}

/**
 * Обёртка поля: сама раздаёт id и связывает label / input / hint / error
 * через aria-describedby. Ошибка объявляется в live-region, чтобы
 * скринридер сообщил о ней сразу после валидации (WCAG 3.3.1).
 */
export function Field({ label, children, error, hint, required, className }: FieldProps) {
  const id = useId();
  const value: FieldContextValue = {
    inputId: `${id}-input`,
    errorId: `${id}-error`,
    hintId: `${id}-hint`,
    hasError: Boolean(error),
    hasHint: Boolean(hint),
  };

  return (
    <FieldContext.Provider value={value}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label
          htmlFor={value.inputId}
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400"
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="ml-1 text-neutral-900 dark:text-neutral-100">
              *
            </span>
          ) : null}
        </label>

        {children}

        {hint && !error ? (
          <p id={value.hintId} className="text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
            {hint}
          </p>
        ) : null}

        <p
          id={value.errorId}
          role="alert"
          aria-live="polite"
          className={cn(
            'text-[11px] leading-relaxed text-red-600 dark:text-red-400',
            error ? 'block' : 'hidden',
          )}
        >
          {error}
        </p>
      </div>
    </FieldContext.Provider>
  );
}
