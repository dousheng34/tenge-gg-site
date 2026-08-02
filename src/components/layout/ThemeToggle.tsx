'use client';

import { useEffect, useState } from 'react';

/** Тема хранится в localStorage; первичное значение выставляет инлайн-скрипт в layout (без FOUC). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* приватный режим — тема просто не запомнится */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-pressed={dark}
      className="grid size-8 place-items-center border border-neutral-200 text-xs transition-colors hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-100"
    >
      <span aria-hidden="true">{dark ? '☾' : '☀'}</span>
    </button>
  );
}
