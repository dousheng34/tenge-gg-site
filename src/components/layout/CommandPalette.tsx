'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { gameGlyph, kzt, GAMES } from '@/lib/format';
import { getBrowserClient } from '@/lib/supabase/browser';

interface Hit {
  id: string;
  title: string;
  price: number;
  game_type: string | null;
}

const NAV = [
  { href: '/catalog', label: 'Каталог', hint: 'Все лоты' },
  { href: '/orders', label: 'Мои сделки', hint: 'Покупки и продажи' },
  { href: '/sell', label: 'Выставить лот', hint: 'Создать объявление' },
  { href: '/arbitration', label: 'Арбитраж', hint: 'Очередь споров' },
];

/**
 * ⌘K / Ctrl+K. Поиск идёт напрямую в PostgREST с дебаунсом и отменой
 * устаревших запросов — гонки ответов не перетирают свежий результат.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else { setQ(''); setHits([]); setActive(0); }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }

    setLoading(true);
    const ticket = ++seq.current;
    const timer = setTimeout(async () => {
      const { data } = await getBrowserClient()
        .from('listings')
        .select('id,title,price,game_type')
        .eq('status', 'active')
        .ilike('title', `%${term.replace(/[%_]/g, '')}%`)
        .limit(6);

      if (ticket !== seq.current) return;      // пришёл устаревший ответ — игнорируем
      setHits((data ?? []) as Hit[]);
      setActive(0);
      setLoading(false);
    }, 180);

    return () => clearTimeout(timer);
  }, [q]);

  const rows = useMemo(
    () => [
      ...hits.map((h) => ({ key: h.id, href: `/lot/${h.id}`, label: h.title, hint: kzt(h.price), glyph: gameGlyph(h.game_type) })),
      ...NAV.filter((n) => !q || n.label.toLowerCase().includes(q.toLowerCase()))
        .map((n) => ({ key: n.href, href: n.href, label: n.label, hint: n.hint, glyph: '→' })),
    ],
    [hits, q],
  );

  const go = useCallback(
    (href: string) => { setOpen(false); router.push(href); },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { const row = rows[active]; if (row) go(row.href); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-900 sm:flex dark:border-neutral-800 dark:hover:border-neutral-100"
      >
        <span aria-hidden="true">⌕</span>
        <span>Поиск лотов</span>
        <kbd className="ml-2 border border-neutral-200 px-1 text-[10px] dark:border-neutral-800">⌘K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[12vh]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Быстрый поиск"
            className="relative z-10 w-full max-w-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={rows[active] ? `cmdk-${rows[active].key}` : undefined}
              placeholder="Лот, игра или раздел…"
              className="w-full border-b border-neutral-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-800"
            />

            <ul id="cmdk-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
              {loading && rows.length === 0 ? (
                <li className="px-4 py-3 text-xs text-neutral-400">Ищем…</li>
              ) : rows.length === 0 ? (
                <li className="px-4 py-3 text-xs text-neutral-400">Ничего не найдено</li>
              ) : (
                rows.map((row, i) => (
                  <li key={row.key} id={`cmdk-${row.key}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(row.href)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
                        i === active && 'bg-neutral-100 dark:bg-neutral-900',
                      )}
                    >
                      <span aria-hidden="true" className="w-5 shrink-0 text-center">{row.glyph}</span>
                      <span className="min-w-0 flex-1 truncate">{row.label}</span>
                      <span className="num shrink-0 text-xs text-neutral-400">{row.hint}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="flex items-center gap-3 border-t border-neutral-200 px-4 py-2 text-[10px] text-neutral-400 dark:border-neutral-800">
              <span>↑↓ навигация</span><span>↵ открыть</span><span>esc закрыть</span>
              <span className="ml-auto">{GAMES.length} игр в каталоге</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
