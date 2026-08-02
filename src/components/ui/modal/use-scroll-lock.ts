'use client';

import { useLayoutEffect } from 'react';

/**
 * Блокировка прокрутки body без «прыжка» контента: ширина исчезнувшего
 * скроллбара компенсируется padding-right. Поддерживает вложенные модалки
 * через счётчик блокировок.
 */
let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function useScrollLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const { body, documentElement } = document;

    if (lockCount === 0) {
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;

      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + scrollbarWidth}px`;
      }
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        body.style.overflow = previousOverflow;
        body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [active]);
}
