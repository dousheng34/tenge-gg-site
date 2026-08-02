-- ============================================================================
-- tenge.gg — Escrow State Machine :: 01 SCHEMA
-- Postgres 17 / Supabase (project: nexora)
--
-- Цель: перевести MVP-таблицу public.orders на строгую типизированную
-- стейт-машину, добавить денежный журнал (public.transactions), журнал
-- вебхуков платёжного провайдера (public.payment_webhooks) и append-only
-- аудит переходов (public.order_events).
--
-- Идемпотентно: миграция переносима и повторно применима (IF NOT EXISTS).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. ENUM-типы
-- ---------------------------------------------------------------------------

-- Канонические состояния + DEPRECATED-алиасы легаси-фронтенда
-- (FUNDS_HOLD -> ESCROW_HOLD, DATA_TRANSFERRED -> VERIFYING).
-- Алиасы существуют ТОЛЬКО чтобы статический сайт на GitHub Pages не падал
-- на INSERT/UPDATE до выката Next.js. BEFORE-триггер нормализует их
-- в канонические значения, CHECK-констрейнт запрещает их хранение.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'CREATED',            -- заказ создан, QR ещё не выпущен
      'PENDING_PAYMENT',    -- Kaspi QR выпущен, ждём вебхук
      'ESCROW_HOLD',        -- деньги на транзитном счёте ТОО
      'VERIFYING',          -- продавец передал данные, покупатель проверяет
      'DISPUTE',            -- арбитраж
      'COMPLETED',          -- выплата продавцу
      'REFUNDED',           -- возврат покупателю
      'CANCELLED',          -- отменён до оплаты
      'EXPIRED',            -- QR протух, оплата не пришла
      'FUNDS_HOLD',         -- DEPRECATED alias -> ESCROW_HOLD
      'DATA_TRANSFERRED'    -- DEPRECATED alias -> VERIFYING
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_actor') then
    create type public.escrow_actor as enum ('BUYER','SELLER','ARBITER','SYSTEM');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type public.payment_provider as enum ('KASPI_QR','MANUAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_tx_type') then
    create type public.escrow_tx_type as enum ('HOLD','FEE','PAYOUT','REFUND','CHARGEBACK');
  end if;

  if not exists (select 1 from pg_type where typname = 'escrow_tx_status') then
    create type public.escrow_tx_status as enum ('PENDING','POSTED','FAILED','REVERSED');
  end if;

  if not exists (select 1 from pg_type where typname = 'webhook_status') then
    create type public.webhook_status as enum ('RECEIVED','PROCESSED','DUPLICATE','REJECTED','FAILED');
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 2. Роли: разделяем is_staff() на is_admin() / is_arbiter()
--    (арбитр НЕ должен видеть всё подряд — только DISPUTE)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_arbiter()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('arbiter','admin')
  );
$$;

comment on function public.is_admin()   is 'true для роли admin (полный доступ).';
comment on function public.is_arbiter() is 'true для роли arbiter/admin. Доступ к данным ограничен статусом DISPUTE политиками RLS.';

-- ---------------------------------------------------------------------------
-- 3. public.orders -> строгая стейт-машина
-- ---------------------------------------------------------------------------

-- 3.1 Политики/триггеры, зависящие от orders.status как от text, снимаются
--     на время ALTER TYPE и пересоздаются ниже (или в 02_rls.sql).
drop policy if exists reviews_insert_after_deal on public.reviews;
drop trigger if exists trg_order_transition on public.orders;

-- 3.2 Нормализация возможных легаси-значений перед сменой типа
update public.orders set status = 'ESCROW_HOLD' where status = 'FUNDS_HOLD';
update public.orders set status = 'VERIFYING'   where status = 'DATA_TRANSFERRED';
update public.orders set status = 'CREATED'     where status is null;

-- 3.3 Смена типа колонки
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name='status') <> 'USER-DEFINED'
  then
    alter table public.orders
      alter column status drop default,
      alter column status type public.order_status using status::public.order_status,
      alter column status set default 'CREATED'::public.order_status,
      alter column status set not null;
  end if;
end$$;

-- 3.4 Поля стейт-машины, денег и платёжного провайдера
alter table public.orders
  add column if not exists version            integer                  not null default 1,
  add column if not exists currency           char(3)                  not null default 'KZT',
  add column if not exists provider           public.payment_provider  not null default 'KASPI_QR',
  add column if not exists payment_intent_id  text,
  add column if not exists payment_id         text,
  add column if not exists qr_expires_at      timestamptz,
  add column if not exists paid_at            timestamptz,
  add column if not exists escrow_held_at     timestamptz,
  add column if not exists delivered_at       timestamptz,
  add column if not exists auto_complete_at   timestamptz,
  add column if not exists dispute_opened_at  timestamptz,
  add column if not exists dispute_reason     text,
  add column if not exists resolved_at        timestamptz,
  add column if not exists resolved_by        uuid,
  add column if not exists cancel_reason      text,
  add column if not exists status_changed_at  timestamptz              not null default now(),
  add column if not exists idempotency_key    text;

-- Деньги в минорных единицах (тиын) — единственный источник правды для
-- сверки с Kaspi. numeric-колонки MVP остаются как «витрина».
alter table public.orders
  add column if not exists total_minor  bigint
    generated always as (round(coalesce(escrow_amount,0) * 100)::bigint) stored,
  add column if not exists fee_minor    bigint
    generated always as (round(coalesce(fee_amount,0) * 100)::bigint) stored,
  add column if not exists payout_minor bigint
    generated always as (round((coalesce(escrow_amount,0) - coalesce(fee_amount,0)) * 100)::bigint) stored;

alter table public.orders
  alter column updated_at set default now();

-- 3.5 Инварианты данных
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_not_deprecated') then
    alter table public.orders add constraint orders_status_not_deprecated
      check (status not in ('FUNDS_HOLD','DATA_TRANSFERRED')) not valid;
    alter table public.orders validate constraint orders_status_not_deprecated;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_amounts_sane') then
    alter table public.orders add constraint orders_amounts_sane
      check (escrow_amount >= 0 and fee_amount >= 0 and fee_amount <= escrow_amount) not valid;
    alter table public.orders validate constraint orders_amounts_sane;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_parties_distinct') then
    alter table public.orders add constraint orders_parties_distinct
      check (buyer_id is null or seller_id is null or buyer_id <> seller_id) not valid;
    alter table public.orders validate constraint orders_parties_distinct;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_terminal_requires_resolution') then
    alter table public.orders add constraint orders_terminal_requires_resolution
      check (status not in ('COMPLETED','REFUNDED') or resolved_at is not null) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_currency_kzt') then
    alter table public.orders add constraint orders_currency_kzt check (currency = 'KZT') not valid;
  end if;
end$$;

-- Один платёж Kaspi — один заказ (защита от повторного зачисления).
create unique index if not exists ux_orders_payment_id
  on public.orders (payment_id) where payment_id is not null;
create unique index if not exists ux_orders_idempotency_key
  on public.orders (idempotency_key) where idempotency_key is not null;

create index if not exists ix_orders_buyer   on public.orders (buyer_id, created_at desc);
create index if not exists ix_orders_seller  on public.orders (seller_id, created_at desc);
create index if not exists ix_orders_status  on public.orders (status, created_at desc);
create index if not exists ix_orders_dispute on public.orders (created_at desc) where status = 'DISPUTE';
create index if not exists ix_orders_autocomplete
  on public.orders (auto_complete_at) where status = 'VERIFYING';
create index if not exists ix_orders_pending_payment
  on public.orders (qr_expires_at) where status = 'PENDING_PAYMENT';

-- ---------------------------------------------------------------------------
-- 4. public.transactions — денежный журнал escrow (append-only)
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete restrict,
  type                public.escrow_tx_type   not null,
  status              public.escrow_tx_status not null default 'POSTED',
  amount_minor        bigint                  not null check (amount_minor > 0),
  currency            char(3)                 not null default 'KZT',
  provider            public.payment_provider not null default 'KASPI_QR',
  provider_payment_id text,
  provider_event_id   text,
  -- Ключ идемпотентности: сервисный слой формирует детерминированно
  -- (kaspi:<eventId>, payout:<orderId>, refund:<orderId> ...).
  idempotency_key     text not null,
  actor_id            uuid,
  actor_role          public.escrow_actor not null default 'SYSTEM',
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  posted_at           timestamptz,
  constraint transactions_idempotency_key_uniq unique (idempotency_key),
  constraint transactions_currency_kzt check (currency = 'KZT')
);

-- Ровно один HOLD на заказ и ровно одна терминальная выплата/возврат.
create unique index if not exists ux_tx_hold_per_order
  on public.transactions (order_id) where type = 'HOLD' and status <> 'FAILED';
create unique index if not exists ux_tx_settlement_per_order
  on public.transactions (order_id) where type in ('PAYOUT','REFUND') and status <> 'FAILED';
create index if not exists ix_tx_order on public.transactions (order_id, created_at desc);
create index if not exists ix_tx_provider_payment on public.transactions (provider_payment_id);

comment on table public.transactions is
  'Денежный журнал escrow. Пишется только SECURITY DEFINER-функциями стейт-машины. Строки неизменяемы.';

-- ---------------------------------------------------------------------------
-- 5. public.payment_webhooks — журнал вебхуков + слой идемпотентности
-- ---------------------------------------------------------------------------

create table if not exists public.payment_webhooks (
  id            bigint generated always as identity primary key,
  provider      public.payment_provider not null default 'KASPI_QR',
  event_id      text not null,
  event_type    text,
  order_id      uuid references public.orders(id) on delete set null,
  payment_id    text,
  amount_minor  bigint,
  signature     text,
  raw           jsonb not null,
  status        public.webhook_status not null default 'RECEIVED',
  error_code    text,
  attempts      integer not null default 1,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  constraint payment_webhooks_event_uniq unique (provider, event_id)
);

create index if not exists ix_webhooks_order  on public.payment_webhooks (order_id);
create index if not exists ix_webhooks_status on public.payment_webhooks (status, received_at desc);

comment on table public.payment_webhooks is
  'Единственный источник идемпотентности для вебхуков Kaspi: UNIQUE(provider, event_id).';

-- ---------------------------------------------------------------------------
-- 6. public.order_events — append-only аудит переходов
-- ---------------------------------------------------------------------------

create table if not exists public.order_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders(id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  actor_id     uuid,
  actor_role   public.escrow_actor not null,
  reason       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists ix_order_events_order on public.order_events (order_id, created_at desc);

-- Запрет UPDATE/DELETE на уровне ядра (даже для владельца таблицы).
create or replace function public.tg_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Таблица % доступна только на добавление', TG_TABLE_NAME
    using errcode = 'ESC06';
end$$;

drop trigger if exists trg_order_events_append_only on public.order_events;
create trigger trg_order_events_append_only
  before update or delete on public.order_events
  for each row execute function public.tg_append_only();

drop trigger if exists trg_transactions_append_only on public.transactions;
create trigger trg_transactions_append_only
  before delete on public.transactions
  for each row execute function public.tg_append_only();

-- ---------------------------------------------------------------------------
-- 7. Совместимость: пересоздаём политику отзывов под ENUM
-- ---------------------------------------------------------------------------

create policy reviews_insert_after_deal on public.reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.buyer_id = auth.uid()
        and o.status = 'COMPLETED'::public.order_status
    )
  );

commit;
