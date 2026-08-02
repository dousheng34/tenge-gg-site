'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { getBrowserClient } from '@/lib/supabase/browser';

export function AuthForm({ next }: { next: string }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) {
      setError('Введите корректный e-mail');
      return;
    }

    setError(undefined);
    setPending(true);

    const { error: authError } = await getBrowserClient().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });

    setPending(false);

    if (authError) {
      setError(authError.message);
      toast.error('Не удалось отправить ссылку', { description: authError.message });
      return;
    }

    setSent(true);
    toast.success('Ссылка отправлена', { description: `Проверьте почту ${value}` });
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Письмо отправлено</p>
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Откройте ссылку из письма на этом устройстве. Срок действия — 1 час.
        </p>
        <button type="button" onClick={() => setSent(false)} className="self-start text-xs underline underline-offset-4">
          Отправить ещё раз
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="E-mail" required error={error}>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mail.kz"
          autoComplete="email"
          enterKeyHint="send"
        />
      </Field>
      <Button type="submit" loading={pending} className="w-full">Получить ссылку</Button>
    </form>
  );
}
