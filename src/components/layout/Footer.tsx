import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-neutral-200 py-10 dark:border-neutral-800">
      <div className="section flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <p className="text-sm font-semibold">tenge<span className="text-[rgb(var(--accent))]">.gg</span></p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Игровой маркетплейс Казахстана. Оплата Kaspi QR, деньги держатся на escrow-счёте ТОО
            до подтверждения покупателем.
          </p>
        </div>

        <nav aria-label="Разделы сайта" className="grid grid-cols-2 gap-x-10 gap-y-1 text-xs text-neutral-500">
          <Link href="/catalog" className="hover:text-neutral-900 dark:hover:text-neutral-50">Каталог</Link>
          <Link href="/sell" className="hover:text-neutral-900 dark:hover:text-neutral-50">Продать</Link>
          <Link href="/orders" className="hover:text-neutral-900 dark:hover:text-neutral-50">Мои сделки</Link>
          <Link href="/arbitration" className="hover:text-neutral-900 dark:hover:text-neutral-50">Арбитраж</Link>
        </nav>

        <p className="num text-[11px] text-neutral-400">
          Комиссия 5% · Арбитраж 24/7 · © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
