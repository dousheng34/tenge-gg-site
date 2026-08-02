-- ============================================================================
-- tenge.gg — Escrow State Machine :: 03 RLS (полная изоляция участников)
--
-- Матрица доступа:
--   buyer    -> только свои покупки (orders.buyer_id = auth.uid())
--   seller   -> только свои продажи (orders.seller_id = auth.uid())
--   arbiter  -> ТОЛЬКО сделки в статусе DISPUTE (и их сообщения/транзакции)
--   admin    -> всё (операционный доступ), действия пишутся в order_events
--   anon     -> ничего
--
-- Записи в orders/transactions/payment_webhooks/order_events выполняются
-- исключительно SECURITY DEFINER-функциями стейт-машины.
-- ============================================================================

begin;

alter table public.orders           enable row level security;
alter table public.transactions     enable row level security;
alter table public.payment_webhooks enable row level security;
alter table public.order_events     enable row level security;

-- ---------------------------------------------------------------------------
-- 1. Табличные гранты (PostgREST) — минимум необходимого
-- ---------------------------------------------------------------------------

revoke all on public.transactions,
              public.payment_webhooks,
              public.order_events from anon, authenticated;

grant select on public.transactions     to authenticated;
grant select on public.order_events     to authenticated;
grant select on public.payment_webhooks to authenticated;   -- отсечётся RLS: только admin

revoke insert, update, delete on public.transactions, public.payment_webhooks, public.order_events
  from anon, authenticated;

revoke delete on public.orders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. orders
-- ---------------------------------------------------------------------------

drop policy if exists or_read           on public.orders;
drop policy if exists or_insert_buyer   on public.orders;
drop policy if exists or_update_party   on public.orders;

-- 2.1 SELECT — раздельные политики (планировщик берёт их через OR,
--     но каждая читается и аудируется независимо)
create policy orders_select_buyer on public.orders
  for select to authenticated
  using (buyer_id = auth.uid());

create policy orders_select_seller on public.orders
  for select to authenticated
  using (seller_id = auth.uid());

-- Арбитр видит ТОЛЬКО спорные сделки
create policy orders_select_arbiter on public.orders
  for select to authenticated
  using (status = 'DISPUTE'::public.order_status and public.is_arbiter());

create policy orders_select_admin on public.orders
  for select to authenticated
  using (public.is_admin());

-- 2.2 INSERT — только от своего имени и только в «безденежных» статусах.
--     ESCROW_HOLD выставляется исключительно вебхуком (service_role);
--     клиентский INSERT принудительно понижается триггером до PENDING_PAYMENT.
create policy orders_insert_buyer on public.orders
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and status in ('CREATED'::public.order_status, 'PENDING_PAYMENT'::public.order_status)
  );

-- 2.3 UPDATE — ПЕРЕХОДНАЯ политика для легаси статического фронтенда.
--     Любой апдейт всё равно проходит через enforce_order_transition():
--     запрещены смена сумм/участников, недопустимые рёбра графа и выход
--     из терминальных статусов и из DISPUTE.
--     CUTOVER: после перевода UI на RPC выполнить
--       drop policy orders_update_participant_legacy on public.orders;
create policy orders_update_participant_legacy on public.orders
  for update to authenticated
  using (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or (public.is_arbiter() and status = 'DISPUTE'::public.order_status)
    or public.is_admin()
  )
  with check (
    buyer_id = auth.uid()
    or seller_id = auth.uid()
    or public.is_arbiter()
    or public.is_admin()
  );

comment on policy orders_update_participant_legacy on public.orders is
  'DEPRECATED. Совместимость со статическим UI. Удалить после перевода клиента на RPC (buyer_confirm_order/seller_mark_delivered/open_dispute).';

-- ---------------------------------------------------------------------------
-- 3. transactions — только чтение своих денег
-- ---------------------------------------------------------------------------

drop policy if exists tx_select_party   on public.transactions;
drop policy if exists tx_select_arbiter on public.transactions;
drop policy if exists tx_select_admin   on public.transactions;

create policy tx_select_party on public.transactions
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = transactions.order_id
       and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));

create policy tx_select_arbiter on public.transactions
  for select to authenticated
  using (public.is_arbiter() and exists (
    select 1 from public.orders o
     where o.id = transactions.order_id
       and o.status = 'DISPUTE'::public.order_status
  ));

create policy tx_select_admin on public.transactions
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. order_events — тайминг-лайн сделки участникам
-- ---------------------------------------------------------------------------

drop policy if exists oe_select_party   on public.order_events;
drop policy if exists oe_select_arbiter on public.order_events;
drop policy if exists oe_select_admin   on public.order_events;

create policy oe_select_party on public.order_events
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_events.order_id
       and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  ));

create policy oe_select_arbiter on public.order_events
  for select to authenticated
  using (public.is_arbiter() and exists (
    select 1 from public.orders o
     where o.id = order_events.order_id
       and o.status = 'DISPUTE'::public.order_status
  ));

create policy oe_select_admin on public.order_events
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. payment_webhooks — сырые платёжные события только админу
-- ---------------------------------------------------------------------------

drop policy if exists pw_select_admin on public.payment_webhooks;

create policy pw_select_admin on public.payment_webhooks
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. trade_messages — арбитр только по спорным сделкам
-- ---------------------------------------------------------------------------

drop policy if exists tm_read  on public.trade_messages;
drop policy if exists tm_write on public.trade_messages;

create policy tm_read on public.trade_messages
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = trade_messages.order_id
       and (
         o.buyer_id = auth.uid()
         or o.seller_id = auth.uid()
         or public.is_admin()
         or (public.is_arbiter() and o.status = 'DISPUTE'::public.order_status)
       )
  ));

create policy tm_write on public.trade_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = trade_messages.order_id
         and (
           o.buyer_id = auth.uid()
           or o.seller_id = auth.uid()
           or (public.is_arbiter() and o.status = 'DISPUTE'::public.order_status)
         )
         and not public.escrow_is_terminal(o.status)
    )
  );

commit;
