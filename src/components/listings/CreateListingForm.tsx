'use client';

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import {
  LISTING_LIMITS,
  calcFee,
  createListingSchema,
  formatTenge,
  type CreateListingInput,
  type CreateListingValues,
} from '@/lib/validation/listing.schema';

export interface CreateListingFormProps {
  /** Отправка на сервер (Server Action / RPC). Ошибку показываем тостом. */
  onSubmit: (values: CreateListingValues) => Promise<void>;
  onCancel?: () => void;
  defaultValues?: Partial<CreateListingInput>;
}

/**
 * Форма «Добавление лота».
 *
 * Валидация: zod-схема (единая с серверной проверкой), режим onTouched —
 * не кричим ошибками, пока пользователь печатает первый раз, но после
 * первого блюра валидируем на каждый ввод.
 */
export function CreateListingForm({ onSubmit, onCancel, defaultValues }: CreateListingFormProps) {
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting, isValid },
  } = useForm<CreateListingInput, unknown, CreateListingValues>({
    resolver: zodResolver(createListingSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { title: '', price: '', description: '', ...defaultValues },
  });

  const priceRaw = watch('price');
  const description = watch('description') ?? '';

  const payout = useMemo(() => {
    const parsed = Number.parseInt(String(priceRaw ?? '').replace(/\D/g, ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const fee = calcFee(parsed);
    return { fee, net: parsed - fee };
  }, [priceRaw]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      toast.success('Лот отправлен на модерацию', {
        description: 'Появится в каталоге после проверки — обычно до 15 минут.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить лот';
      setError('root', { message });
      toast.error('Лот не сохранён', { description: message });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Название лота" required error={errors.title?.message} hint="Например: Standoff 2 · Gold · 12 000 голды">
        <Input
          {...register('title')}
          placeholder="Аккаунт CS2 · Prime · 3 медали"
          autoComplete="off"
          maxLength={LISTING_LIMITS.title.max}
          enterKeyHint="next"
        />
      </Field>

      <Field
        label="Цена"
        required
        error={typeof errors.price?.message === 'string' ? errors.price.message : undefined}
        hint={payout ? `Комиссия 5%: ${formatTenge(payout.fee)} · вам: ${formatTenge(payout.net)}` : 'Целое число, только цифры'}
      >
        <Input
          {...register('price', {
            // Чистим ввод на лету: пользователь физически не введёт мусор.
            setValueAs: (value: string) => String(value ?? '').replace(/\D/g, ''),
          })}
          suffix="₸"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="15000"
          autoComplete="off"
          maxLength={9}
        />
      </Field>

      <Field
        label="Описание"
        required
        error={errors.description?.message}
        hint={`${description.length} / ${LISTING_LIMITS.description.max}`}
      >
        <Textarea
          {...register('description')}
          rows={5}
          placeholder="Что входит в лот, привязки, регион, как проходит передача."
          maxLength={LISTING_LIMITS.description.max}
        />
      </Field>

      {errors.root?.message ? (
        <p role="alert" className="border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-600 dark:text-red-400">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Отмена
          </Button>
        ) : null}
        <Button type="submit" loading={isSubmitting} disabled={!isValid && Object.keys(errors).length > 0}>
          Выставить лот
        </Button>
      </div>
    </form>
  );
}
