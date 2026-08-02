'use client';

import { createContext } from 'react';

import type { ToastApi } from './types';

/**
 * Контекст хранит ТОЛЬКО стабильный API (никакого массива тостов):
 * потребители `useToast()` не ререндерятся при появлении новых тостов.
 */
export const ToastContext = createContext<ToastApi | null>(null);
ToastContext.displayName = 'ToastContext';
