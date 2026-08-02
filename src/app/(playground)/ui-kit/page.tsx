'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ItemCardSkeletonGrid } from '@/components/ui/skeleton/ItemCardSkeleton';
import { Modal } from '@/components/ui/modal';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { CreateListingModal } from '@/components/listings/CreateListingModal';
import type { CreateListingValues } from '@/lib/validation/listing.schema';

function Playground() {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [listingOpen, setListingOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const submitListing = async (values: CreateListingValues) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (values.price > 1_000_000) throw new Error('Лоты дороже 1 000 000 ₸ проходят ручную проверку');
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-sm font-medium uppercase tracking-[0.12em] text-neutral-900 dark:text-neutral-50">
          tenge.gg · UI kit
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Skeleton · Toast · Modal · Form validation
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Toasts</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => toast.success('Сделка подтверждена', { description: 'Выплата продавцу поставлена в очередь.' })}>
            success
          </Button>
          <Button
            variant="danger"
            onClick={() => toast.error('Платёж не прошёл', { description: 'Kaspi вернул код 402. Повторите оплату.' })}
          >
            error
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info('Продавец передал данные', {
                description: 'Проверьте аккаунт в течение 72 часов.',
                action: { label: 'Открыть сделку', onClick: () => undefined },
              })
            }
          >
            info
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Modals</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setListingOpen(true)}>
            Выставить лот
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            Открыть спор
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-neutral-400">Каталог</h2>
          <Button variant="ghost" onClick={() => setLoading((prev) => !prev)}>
            {loading ? 'Показать контент' : 'Показать скелет'}
          </Button>
        </div>
        {loading ? (
          <ItemCardSkeletonGrid count={8} />
        ) : (
          <p className="text-xs text-neutral-500">Здесь рендерится реальная сетка лотов.</p>
        )}
      </section>

      <CreateListingModal open={listingOpen} onClose={() => setListingOpen(false)} onSubmit={submitListing} />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Открыть спор"
        description="Деньги останутся на escrow-счёте до решения арбитра."
        destructive
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmOpen(false);
                toast.error('Спор открыт', { description: 'Арбитр подключится в течение 24 часов.' });
              }}
            >
              Открыть спор
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Приложите доказательства в чат сделки: скриншоты, видео передачи данных, переписку.
        </p>
      </Modal>
    </main>
  );
}

export default function UiKitPage() {
  return (
    <ToastProvider>
      <Playground />
    </ToastProvider>
  );
}
