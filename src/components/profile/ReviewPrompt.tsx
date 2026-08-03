'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { kzt } from '@/lib/format';
import { submitReviewAction } from '@/app/actions/profile';
import { PROFILE_LIMITS } from '@/lib/validation/profile.schema';

export interface ReviewPromptProps {
  orderId: string;
  title: string;
  amount: number;
}

const STARS = [1, 2, 3, 4, 5] as const;

/** Отзыв по завершённой сделке: оценка радиогруппой (доступно с клавиатуры) + текст. */
export function ReviewPrompt({ orderId, title, amount }: ReviewPromptProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  const tooShort = text.trim().length < PROFILE_LIMITS.reviewText.min;

  const send = () => {
    startTransition(async () => {
      const res = await submitReviewAction({ orderId, rating, text });
      if (!res.ok) {
        toast.error('Отзыв не сохранён', { description: res.message });
        return;
      }
      setOpen(false);
      toast.success('Спасибо за отзыв', { description: 'Он появится в профиле продавца.' });
      router.refresh();
    });
  };

  return (
    <>
      <li className="card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="num mt-0.5 text-xs text-neutral-500">{kzt(amount)}</p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Оставить отзыв
        </Button>
      </li>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Отзыв о сделке"
        description={title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={send} loading={pending} disabled={rating === 0 || tooShort}>
              Опубликовать
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="label">Оценка</legend>
            <div className="mt-1.5 flex gap-1">
              {STARS.map((value) => (
                <label
                  key={value}
                  className="cursor-pointer text-2xl leading-none"
                  aria-label={`${value} из 5`}
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className={value <= rating ? 'opacity-100' : 'opacity-25'}>
                    ★
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            label="Как прошла сделка"
            required
            hint={`Минимум ${PROFILE_LIMITS.reviewText.min} символов.`}
            error={text.length > 0 && tooShort ? 'Напишите чуть подробнее' : undefined}
          >
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
