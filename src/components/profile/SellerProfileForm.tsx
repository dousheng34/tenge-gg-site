'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { updateSellerProfileAction } from '@/app/actions/profile';
import { PROFILE_LIMITS, sellerProfileSchema } from '@/lib/validation/profile.schema';

export interface SellerProfileFormProps {
  nickname: string;
  city: string;
  email: string | null;
}

/** Ник и город продавца. Валидация той же схемой, что и на сервере. */
export function SellerProfileForm({ nickname, city, email }: SellerProfileFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState({ nickname, city });
  const [touched, setTouched] = useState(false);

  const parsed = sellerProfileSchema.safeParse(values);
  const errors = parsed.success
    ? {}
    : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));

  const dirty = values.nickname !== nickname || values.city !== city;

  const save = () => {
    setTouched(true);
    if (!parsed.success) return;

    startTransition(async () => {
      const res = await updateSellerProfileAction(parsed.data);
      if (!res.ok) {
        toast.error('Не сохранено', { description: res.message });
        return;
      }
      toast.success('Профиль обновлён');
      router.refresh();
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ник"
          required
          hint={`${PROFILE_LIMITS.nickname.min}–${PROFILE_LIMITS.nickname.max} символа. Видят покупатели.`}
          error={touched ? errors.nickname : undefined}
        >
          <Input
            value={values.nickname}
            onChange={(e) => setValues((v) => ({ ...v, nickname: e.target.value }))}
            autoComplete="nickname"
          />
        </Field>

        <Field label="Город" hint="Необязательно. Показывается в отзывах." error={touched ? errors.city : undefined}>
          <Input
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
            autoComplete="address-level2"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!dirty}>
          Сохранить
        </Button>
        {email ? <span className="num text-xs text-neutral-500">{email}</span> : null}
      </div>
    </form>
  );
}
