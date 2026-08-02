'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200',
  secondary:
    'border border-neutral-200 bg-white text-neutral-900 hover:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:hover:border-neutral-100',
  ghost: 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-50',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', loading = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 px-4 text-xs font-medium',
        'uppercase tracking-[0.08em] transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900',
        'disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:outline-neutral-100',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-3 animate-spin border border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
});
