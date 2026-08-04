'use client';

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { useToast } from '@/components/ui/toast';
import { getBrowserClient } from '@/lib/supabase/browser';
import { sendTradeMessageAction } from '@/app/actions/listings';

export interface ChatMessage {
  id: number;
  sender_id: string | null;
  body: string;
  created_at: string;
}

/**
 * Чат сделки. Сообщения приходят через Realtime, отправка — Server Action
 * с оптимистичным добавлением. Текст рендерится как текстовый узел (не HTML),
 * плюс на стороне БД работает sanitize-триггер.
 *
 * Контакты и платёжные реквизиты фильтруются на сервере (см. lib/security/contact-leak):
 * клиентская проверка здесь сознательно не дублируется — её обошли бы через прямой вызов action.
 */
export function DealChat({ orderId, me, initial }: { orderId: string; me: string; initial: ChatMessage[] }) {
  const router = useRouter();
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [optimistic, addOptimistic] = useOptimistic(messages, (state, body: string) => [
    ...state,
    { id: -Date.now(), sender_id: me, body, created_at: new Date().toISOString() },
  ]);
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`trade:${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `order_id=eq.${orderId}` },
        (payload: { new: ChatMessage }) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [orderId]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [optimistic.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    startTransition(async () => {
      addOptimistic(text);
      const res = await sendTradeMessageAction(orderId, text);

      if (!res.ok) {
        // Возвращаем текст в поле: сообщение не сохранено, терять его нельзя.
        setDraft(text);
        toast.error('Сообщение не отправлено', { description: res.message });
        return;
      }

      if (res.masked) {
        toast.info('Контакты скрыты', {
          description: `Скрыто: ${res.warning}. Сделка вне сайта не защищена escrow — вернуть деньги будет нечем.`,
          duration: 8000,
        });
      }

      router.refresh();
    });
  };

  return (
    <section aria-label="Чат сделки" className="card flex h-[420px] flex-col">
      <div ref={bodyRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
        {optimistic.length === 0 ? (
          <p className="m-auto max-w-xs text-center text-xs text-neutral-400">
            Сообщений пока нет. Переписка видна только вам двоим и арбитру при споре.
          </p>
        ) : (
          optimistic.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div
                key={m.id}
                className={cn(
                  'max-w-[80%] px-3 py-2 text-[13px] leading-relaxed',
                  mine
                    ? 'self-end bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'self-start border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
                )}
              >
                {m.body}
                <span className="num mt-1 block text-[10px] opacity-50">
                  {new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <label htmlFor="chat-input" className="sr-only">Сообщение</label>
        <input
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Написать второй стороне…"
          className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || draft.trim().length === 0}
          className="border border-neutral-900 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] disabled:opacity-40 dark:border-neutral-100"
        >
          Отправить
        </button>
      </div>
    </section>
  );
}
