# Escrow State Machine — tenge.gg

Отказоустойчивая escrow-система для игрового маркетплейса: Next.js (App Router,
Server Actions) + Supabase (PostgreSQL 17) + Kaspi QR (вебхуки).

Проект Supabase: `nexora` (`axtptzceicyhnmnopaaa`).

---

## 1. Жизненный цикл сделки

```
                    ┌──────────────┐
                    │   CREATED    │  заказ создан, QR не выпущен
                    └──────┬───────┘
              BUYER        │        SYSTEM (оплата раньше QR)
                           ▼
                 ┌──────────────────┐   таймаут QR    ┌──────────┐
                 │ PENDING_PAYMENT  │────────────────▶│ EXPIRED  │
                 └────────┬─────────┘   SYSTEM        └──────────┘
                          │ SYSTEM: вебхук Kaspi (сумма сверена)
                          ▼
                 ┌──────────────────┐  SELLER/SYSTEM  ┌──────────┐
                 │   ESCROW_HOLD    │────────────────▶│ REFUNDED │
                 │ деньги на счёте  │  добровольный   └──────────┘
                 └───┬──────────┬───┘  возврат
          SELLER     │          │  BUYER
     «данные переданы»          │ «подтверждаю»
                     ▼          ▼
             ┌─────────────┐  ┌────────────┐
             │  VERIFYING  │─▶│ COMPLETED  │◀── SYSTEM: авто-релиз через 72ч
             └──────┬──────┘  └────────────┘
        BUYER/SELLER│ «спор»
                    ▼
             ┌─────────────┐   ARBITER    ┌────────────┐ / ┌──────────┐
             │   DISPUTE   │─────────────▶│ COMPLETED  │   │ REFUNDED │
             └─────────────┘  решение     └────────────┘   └──────────┘
```

Терминальные статусы: `COMPLETED`, `REFUNDED`, `CANCELLED`, `EXPIRED` —
исходящих рёбер нет ни у одной роли.

Единственное описание графа — SQL-функция `public.escrow_transition_allowed(from, to, actor)`.
TypeScript-модуль `src/lib/escrow/state-machine.ts` — её зеркало для UI;
источником правды остаётся база.

---

## 2. Модель данных

| Объект | Назначение |
|---|---|
| `public.orders` | Заказ + текущее состояние. `version` — оптимистическая блокировка, `total_minor/fee_minor/payout_minor` — generated-колонки в тиынах |
| `public.transactions` | Денежный журнал: `HOLD`, `FEE`, `PAYOUT`, `REFUND`, `CHARGEBACK`. Только append |
| `public.payment_webhooks` | Все события Kaspi. `UNIQUE(provider, event_id)` — слой идемпотентности |
| `public.order_events` | Append-only аудит каждого перехода: кто, откуда, куда, почему |
| `public.dispute_queue` | Вьюха арбитражной очереди (`security_invoker`) |

ENUM-типы: `order_status`, `escrow_actor`, `payment_provider`, `escrow_tx_type`,
`escrow_tx_status`, `webhook_status`.

Значения `FUNDS_HOLD` и `DATA_TRANSFERRED` в `order_status` — **DEPRECATED**
алиасы легаси-фронтенда, нормализуются триггером в `ESCROW_HOLD` / `VERIFYING`
и запрещены к хранению CHECK-констрейнтом `orders_status_not_deprecated`.

### Денежные инварианты

* Все суммы в тиынах (`bigint`), `numeric`-колонки MVP оставлены как витрина.
* `ux_tx_hold_per_order` — не более одного удержания на заказ.
* `ux_tx_settlement_per_order` — не более одной выплаты **или** возврата.
* `transactions_idempotency_key_uniq` — повтор события не создаёт вторую проводку.
* `orders_amounts_sane`: `0 ≤ fee_amount ≤ escrow_amount`.
* Сумма вебхука сверяется с `orders.total_minor`; расхождение → `REJECTED`,
  статус заказа не меняется.

---

## 3. Идемпотентность вебхука Kaspi

Три независимых уровня, каждый достаточен сам по себе:

1. **Событие** — `INSERT ... ON CONFLICT (provider, event_id) DO NOTHING`.
   Повтор увеличивает `attempts` и сразу возвращает `{ok:true, idempotent:true}`.
2. **Состояние** — заказ читается `FOR UPDATE`; если он уже не в
   `CREATED/PENDING_PAYMENT`, событие помечается `DUPLICATE`, деньги не двигаются.
3. **Проводка** — `escrow_post_transaction` использует
   `ON CONFLICT (idempotency_key) DO NOTHING` (`kaspi:<eventId>`).

HTTP-контракт `/api/webhooks/kaspi`:

| Код | Когда | Поведение Kaspi |
|---|---|---|
| 200 | принято, в т.ч. дубликат | ретраи прекращаются |
| 401 | подпись неверна/просрочена | не ретраить |
| 400 / 422 | тело или сумма некорректны | не ретраить, ручной разбор |
| 500 | временный сбой | ретрай, обработка безопасна |

Подпись: `X-Kaspi-Signature: t=<unix_ts>,v1=<hex>` где
`v1 = HMAC_SHA256(KASPI_WEBHOOK_SECRET, "${t}.${rawBody}")`.
Сравнение — `timingSafeEqual`, окно защиты от replay — 300 секунд.
Подпись считается **до** JSON-парсинга (`request.text()`).

---

## 4. Гонки и конкурентный доступ

| Сценарий атаки/гонки | Механизм защиты |
|---|---|
| Двойное подтверждение сделки | `SELECT ... FOR UPDATE` в RPC + идемпотентный ответ + `ux_tx_settlement_per_order` |
| Вывод денег во время спора | Проверка `status = 'DISPUTE'` под блокировкой строки (`ESC01`); прямой `UPDATE` отсекает триггер |
| Двойная отмена / отмена после оплаты | Терминальные статусы без исходящих рёбер |
| Действие по устаревшему UI-состоянию | Оптимистическая блокировка `p_expected_version` → `ESC02` |
| Подмена суммы/участников/лота | Триггер `enforce_order_transition` запрещает изменение финансовых полей (`ESC03`) |
| Создание «оплаченного» заказа с клиента | `normalize_order_insert` (SECURITY **INVOKER**) понижает статус до `PENDING_PAYMENT`; RLS-политика INSERT допускает только `CREATED/PENDING_PAYMENT` |
| Параллельные запуски cron-джобы | `FOR UPDATE SKIP LOCKED` |
| Двойная доставка вебхука | См. раздел 3 |

Коды ошибок (SQLSTATE → домен → HTTP):

| SQLSTATE | Код | HTTP |
|---|---|---|
| `ESC01` | `INVALID_TRANSITION` | 409 |
| `ESC02` | `VERSION_CONFLICT` | 409 |
| `ESC03` | `FORBIDDEN` | 403 |
| `ESC04` | `ORDER_NOT_FOUND` | 404 |
| `ESC05` | `VALIDATION_FAILED` | 422 |
| `ESC06` | `APPEND_ONLY_VIOLATION` | 409 |

---

## 5. Безопасность (RLS + привилегии)

| Роль | orders | transactions / order_events | payment_webhooks |
|---|---|---|---|
| `anon` | — | — | — |
| покупатель | только свои покупки | по своим сделкам | — |
| продавец | только свои продажи | по своим сделкам | — |
| арбитр | **только `DISPUTE`** | только по спорным сделкам | — |
| админ | всё | всё | всё |

* Запись в `transactions`, `payment_webhooks`, `order_events` из REST невозможна
  (`REVOKE INSERT/UPDATE/DELETE` + append-only триггеры).
* Мутации `orders` выполняются SECURITY DEFINER RPC; переходная политика
  `orders_update_participant_legacy` оставлена для статического UI и удаляется
  одной строкой после cutover (раздел 7).
* Гранты: ядро стейт-машины (`escrow_apply_transition`, `escrow_post_transaction`,
  `escrow_settle`, `escrow_actor_for`) и триггерные функции недоступны
  `anon`/`authenticated`; `kaspi_webhook_capture` и `escrow_run_slas` — только
  `service_role`. Это критично: Supabase по умолчанию раздаёт EXECUTE всем ролям
  через `ALTER DEFAULT PRIVILEGES`, и `REVOKE ... FROM public` этого не снимает.

---

## 6. Слои приложения

```
src/
├── app/
│   ├── api/webhooks/kaspi/route.ts   # приём вебхука: подпись → сервис → HTTP-контракт
│   ├── api/cron/escrow-sla/route.ts  # экспирация QR + авто-релиз (Bearer-секрет)
│   └── actions/orders.ts             # Server Actions участников сделки
├── services/escrow.service.ts        # единая точка вызова RPC
├── lib/escrow/{state-machine,errors}.ts
├── lib/kaspi/{signature,webhook.schema}.ts
├── lib/supabase/{admin,server}.ts    # service-role и user-session клиенты
└── types/database.types.ts           # сгенерировано из схемы
```

Правило: `createAdminClient()` (service role, обходит RLS) допустим только в
route handlers вебхука/cron. Server Actions работают под сессией пользователя,
поэтому RLS остаётся вторым контуром защиты после проверок в RPC.

---

## 7. Runbook

**Применение миграций**

```bash
supabase link --project-ref axtptzceicyhnmnopaaa
supabase db push          # supabase/migrations/*.sql
npm run db:types          # регенерация src/types/database.types.ts
```

**Проверка стейт-машины** (21 сценарий: идемпотентность, гонки, RLS, деньги)

```bash
psql "$SUPABASE_DB_URL" -f supabase/tests/escrow_state_machine_test.sql
```

Скрипт создаёт и удаляет только собственные данные и печатает таблицу
`PASS/FAIL` по каждому сценарию.

**Планировщик SLA** — Vercel Cron `*/5 * * * *` на `/api/cron/escrow-sla`
либо в базе:

```sql
create extension if not exists pg_cron with schema extensions;
select cron.schedule('escrow-slas', '*/5 * * * *', $$select public.escrow_run_slas();$$);
```

**Cutover со статического UI на RPC**

```sql
-- после деплоя Next.js, использующего buyer_confirm_order/seller_mark_delivered/open_dispute
drop policy orders_update_participant_legacy on public.orders;
-- и удаление DEPRECATED-алиасов из ENUM (после проверки отсутствия использований)
```

**Ручное подтверждение оплаты Kaspi** (до подключения боевого API):

```sql
select public.admin_confirm_manual_payment('<order_id>', '<kaspi_payment_id>');
```

Требует роль `admin`, пишет событие в `payment_webhooks` и проводку `HOLD`,
полностью аудируется в `order_events`.

**Диагностика**

```sql
-- зависшие вебхуки
select * from public.payment_webhooks where status in ('RECEIVED','FAILED') order by received_at desc;
-- расхождение денег и статусов
select o.id, o.status, o.total_minor,
       sum(t.amount_minor) filter (where t.type = 'HOLD')   as held,
       sum(t.amount_minor) filter (where t.type = 'PAYOUT') as paid,
       sum(t.amount_minor) filter (where t.type = 'REFUND') as refunded
from public.orders o left join public.transactions t on t.order_id = o.id
group by o.id having o.status = 'COMPLETED' and coalesce(sum(t.amount_minor) filter (where t.type='PAYOUT'),0) = 0;
-- таймлайн сделки
select * from public.order_events where order_id = '<order_id>' order by created_at;
```

---

## 8. Переменные окружения

См. `.env.example`. `SUPABASE_SERVICE_ROLE_KEY`, `KASPI_API_KEY`,
`KASPI_WEBHOOK_SECRET`, `ESCROW_CRON_SECRET` — только серверные, в браузер не
попадают и в git не коммитятся.
