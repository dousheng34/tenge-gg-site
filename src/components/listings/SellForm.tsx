'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { CreateListingForm } from '@/components/listings/CreateListingForm';
import { Field } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { CATEGORIES, GAMES } from '@/lib/format';
import { createListingAction } from '@/app/actions/listings';
import type { CreateListingValues } from '@/lib/validation/listing.schema';

export function SellForm() {
  const router = useRouter();
  const toast = useToast();
  const [game, setGame] = useState<string>(GAMES[0].slug);
  const [category, setCategory] = useState<string>(CATEGORIES[0].slug);

  const submit = async (values: CreateListingValues) => {
    const res = await createListingAction({
      title: values.title,
      price: String(values.price),
      description: values.description,
      game_type: game,
      category,
    });

    if (!res.ok) throw new Error(res.message ?? 'Не удалось сохранить лот');

    toast.success('Лот опубликован', { description: 'Он уже виден в каталоге.' });
    router.push('/catalog');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Игра" required>
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="w-full border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            {GAMES.map((g) => <option key={g.slug} value={g.slug}>{g.title}</option>)}
          </select>
        </Field>

        <Field label="Категория" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950"
          >
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
          </select>
        </Field>
      </div>

      <CreateListingForm onSubmit={submit} />
    </div>
  );
}
