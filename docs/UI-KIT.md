# UI kit — tenge.gg

Дизайн-код: минимализм, Teenage Engineering, строгий финтех.
Прямые углы, 1px-границы, uppercase-микротипографика с трекингом,
табличные цифры для сумм, никаких теней кроме модалки.

## Состав

| Модуль | Путь | Что внутри |
|---|---|---|
| Skeleton | `src/components/ui/skeleton/` | `Skeleton`, `ItemCardSkeleton`, `ItemCardSkeletonGrid` |
| Toast | `src/components/ui/toast/` | `ToastProvider`, `useToast`, `ToastItem` |
| Modal | `src/components/ui/modal/` | `Modal`, `useScrollLock`, `useFocusTrap` |
| Form | `src/components/ui/form/` | `Field`, `Input`, `Textarea` |
| Form пример | `src/components/listings/` | `CreateListingForm`, `CreateListingModal` |
| Схема | `src/lib/validation/listing.schema.ts` | zod + лимиты полей |
| Демо | `src/app/(playground)/ui-kit/page.tsx` | все модули вместе |

## Подключение

```tsx
// app/layout.tsx
import { ToastProvider } from '@/components/ui/toast';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
```

```tsx
const toast = useToast();
toast.success('Сделка подтверждена', { description: 'Выплата в очереди.' });
toast.error('Платёж не прошёл', { duration: 6000 });
const id = toast.info('Загружаем…', { duration: 0 });
toast.dismiss(id);
```

## Решения по производительности

* **Toast**: в контекст уходит только мемоизированный API со стабильными
  ссылками — потребители `useToast()` не ререндерятся при новых уведомлениях,
  перерисовывается лишь viewport. Таймер живёт внутри `ToastItem`,
  поэтому пауза при наведении не трогает стор.
* **Skeleton**: геометрия 1:1 с боевой карточкой (обложка 4:3, две строки
  заголовка, строка продавца, строка цены) → CLS ≈ 0 при подмене контента.
  `ItemCardSkeleton` мемоизирован, сетка — один live-region на весь список.
* **Modal**: портал монтируется только на клиенте, `AnimatePresence`
  размонтирует поддерево после exit-анимации; при закрытии в DOM ничего
  не остаётся.
* **Form**: `mode: 'onTouched'` + `reValidateMode: 'onChange'` — минимум
  ререндеров до первого блюра; `watch` только по двум полям, расчёт комиссии
  в `useMemo`.

## Доступность

* Тосты: `success`/`info` → `role="status"` (polite), `error` → `role="alert"`
  (assertive). Автозакрытие ставится на паузу при hover/focus (WCAG 2.2.1),
  у каждого тоста кнопка закрытия с `aria-label`.
* Модалка: `role="dialog"` (или `alertdialog` для деструктивных),
  `aria-modal`, связка `aria-labelledby` / `aria-describedby`, ловушка Tab,
  возврат фокуса на инициатор при закрытии, ESC на capture-фазе
  (закрывается только верхний слой).
* Формы: `Field` сам раздаёт `id` и связывает label / hint / error через
  `aria-describedby`, ошибка помечена `aria-invalid` и объявляется
  live-region'ом.
* Скелеты скрыты от скринридеров (`aria-hidden`), статус загрузки объявляет
  контейнер (`role="status" aria-busy`).
* Везде поддержан `prefers-reduced-motion`: анимации схлопываются в opacity
  или отключаются (`motion-reduce:animate-none`).
* Фокус видим всегда: `focus-visible:outline` / `ring`, никаких `outline-none`
  без замены.

## Скролл-лок

`useScrollLock` компенсирует ширину исчезнувшего скроллбара через
`padding-right`, поэтому контент не «прыгает». Счётчик блокировок
поддерживает вложенные модалки.

## Зависимости

`framer-motion`, `react-hook-form`, `@hookform/resolvers`, `zod`,
`clsx`, `tailwind-merge`.
