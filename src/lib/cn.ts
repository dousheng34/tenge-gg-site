import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Слияние Tailwind-классов без конфликтов утилит. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
