'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';
import { useField } from './Field';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...props },
  ref,
) {
  const { inputId, errorId, hintId, hasError, hasHint } = useField();
  const isInvalid = invalid ?? hasError;

  return (
    <textarea
      ref={ref}
      id={inputId}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={cn(isInvalid && errorId, hasHint && !isInvalid && hintId) || undefined}
      className={cn(
        'w-full resize-y border bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900',
        'placeholder:text-neutral-400 transition-colors',
        'focus:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder:text-neutral-600',
        isInvalid
          ? 'border-red-500 focus-visible:ring-red-500/40 dark:border-red-500'
          : 'border-neutral-200 focus-visible:border-neutral-900 focus-visible:ring-neutral-900/15 dark:border-neutral-800 dark:focus-visible:border-neutral-100 dark:focus-visible:ring-neutral-100/20',
        className,
      )}
      {...props}
    />
  );
});
