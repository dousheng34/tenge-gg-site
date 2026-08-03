import type { Metadata } from 'next';

import { SellForm } from '@/components/listings/SellForm';

export const metadata: Metadata = { title: 'Выставить лот' };

export default function SellPage() {
  return (
    <div className="section max-w-2xl py-8">
      <h1 className="font-display text-2xl tracking-tight">Новый лот</h1>
      <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Комиссия сервиса 5% удерживается при выплате. Деньги покупателя лежат на escrow-счёте
        до подтверждения — это защищает и вас: подтверждённую сделку нельзя отозвать.
      </p>

      <div className="card mt-6 p-5">
        <SellForm />
      </div>
    </div>
  );
}
