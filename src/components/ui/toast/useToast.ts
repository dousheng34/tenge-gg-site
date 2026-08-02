'use client';

import { useContext } from 'react';

import { ToastContext } from './toast-context';
import type { ToastApi } from './types';

/**
 * Доступ к тостам.
 *
 * Возвращаемый объект стабилен по ссылке — его безопасно класть
 * в массивы зависимостей useEffect/useCallback.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);

  if (!api) {
    throw new Error('useToast() должен вызываться внутри <ToastProvider>');
  }

  return api;
}
