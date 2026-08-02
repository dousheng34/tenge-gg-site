'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { useField } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Единица измерения / иконка справа (например, ₸). */
  suffix?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, suffix, invalid, ...props },
  ref,
) {
  const { inputId, errorId, hintId, hasError, hasHint } = useField();
  const isInvalid = invalid ?? hasError;

  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        id={inputId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={cn(isInvalid && errorId, hasHint && !isInvalid && hintId) || undefined}
        className={cn(
          'w-full border bg-white px-3 py-2 text-sm text-neutral-900 tabular-nums',
          'placeholder:text-neutral-400 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-600',
          isInvalid
            ? 'border-red-500 focus-visible:ring-red-500/40 dark:border-red-500'
            : 'border-neutral-200 focus-visible:border-neutral-900 focus-visible:ring-neutral-900/15 dark:border-neutral-800 dark:focus-visible:border-neutral-100 dark:focus-visible:ring-neutral-100/20',
          suffix ? 'pr-9' : undefined,
          className,
        )}
        {...props}
      />

      {suffix ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 text-xs text-neutral-400 dark:text-neutral-500"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
});
