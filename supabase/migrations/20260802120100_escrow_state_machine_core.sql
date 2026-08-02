-- ============================================================================
-- tenge.gg — Escrow State Machine :: 02 CORE (переходы, блокировки, RPC)
--
-- Инварианты:
--   * Единственный способ сменить статус — UPDATE, проходящий через
--     BEFORE-триггер enforce_order_transition(), который валидирует ребро
--     графа переходов и роль актора. Обхода нет ни у клиента, ни у RPC.
--   * Мутации из приложения идут через SECURITY DEFINER RPC, которые берут
--     пессимистическую блокировку строки (SELECT ... FOR UPDATE) и проверяют
--     оптимистическую версию (orders.version).
--   * Деньги двигаются только вместе с терминальным переходом и защищены
--     UNIQUE-индексами (один HOLD, одна выплата/возврат на заказ).
--
-- Коды ошибок (SQLSTATE):
--   ESC01 invalid_transition      ESC04 order_not_found
--   ESC02 version_conflict        ESC05 amount_mismatch
--   ESC03 forbidden               ESC06 append_only_violation
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Граф переходов
-- ---------------------------------------------------------------------------

create or replace function public.escrow_transition_allowed(
  p_from  public.order_status,
  p_to    public.order_status,
  p_actor public.escrow_actor
)
returns boolean
language sql
immutable
parallel safe
as $$
  select (p_from, p_to, p_actor) in (
    -- SYSTEM (вебхук Kaspi, cron авто-релиза, экспирация QR)
    ('CREATED',         'PENDING_PAYMENT', 'SYSTEM'),
    ('CREATED',         'EXPIRED',         'SYSTEM'),
    ('CREATED',         'CANCELLED',       'SYSTEM'),
    ('CREATED',         'ESCROW_HOLD',     'SYSTEM'),   -- оплата пришла раньше привязки QR
    ('PENDING_PAYMENT', 'ESCROW_HOLD',     'SYSTEM'),
    ('PENDING_PAYMENT', 'EXPIRED',         'SYSTEM'),
    ('PENDING_PAYMENT', 'CANCELLED',       'SYSTEM'),
    ('VERIFYING',       'COMPLETED',       'SYSTEM'),   -- авто-релиз по SLA
    ('ESCROW_HOLD',     'REFUNDED',        'SYSTEM'),   -- продавец не выдал товар в срок

    -- BUYER
    ('CREATED',         'PENDING_PAYMENT', 'BUYER'),
    ('CREATED',         'CANCELLED',       'BUYER'),
    ('PENDING_PAYMENT', 'CANCELLED',       'BUYER'),
    ('ESCROW_HOLD',     'COMPLETED',       'BUYER'),
    ('ESCROW_HOLD',     'DISPUTE',         'BUYER'),
    ('VERIFYING',       'COMPLETED',       'BUYER'),
    ('VERIFYING',       'DISPUTE',         'BUYER'),

    -- SELLER
    ('ESCROW_HOLD',     'VERIFYING',       'SELLER'),   -- данные переданы
    ('ESCROW_HOLD',     'REFUNDED',        'SELLER'),   -- добровольный отказ
    ('VERIFYING',       'DISPUTE',         'SELLER'),

    -- ARBITER
    ('ESCROW_HOLD',     'DISPUTE',         'ARBITER'),
    ('VERIFYING',       'DISPUTE',         'ARBITER'),
    ('DISPUTE',         'COMPLETED',       'ARBITER'),
    ('DISPUTE',         'REFUNDED',        'ARBITER')
  );
$$;

comment on function public.escrow_transition_allowed is
  'Единственное описание графа переходов escrow. Терминальные состояния (COMPLETED/REFUNDED/CANCELLED/EXPIRED) исходящих рёбер не имеют.';

create or replace function public.escrow_is_terminal(p_status public.order_status)
returns boolean language sql immutable parallel safe as $$
  select p_status in ('COMPLETED','REFUNDED','CANCELLED','EXPIRED');
$$;

-- Роль текущего пользователя относительно заказа
create or replace function public.escrow_actor_for(p_order public.orders)
returns public.escrow_actor
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ctx text := current_setting('app.escrow_actor_role', true);
  v_uid uuid := auth.uid();
begin
  -- Контекст, выставленный SECURITY DEFINER RPC (доверенный путь)
  if v_ctx is not null and v_ctx <> '' then
    return v_ctx::public.escrow_actor;
  end if;
  if v_uid is null then
    return null;
  end if;
  if v_uid = p_order.buyer_id  then return 'BUYER';  end if;
  if v_uid = p_order.seller_id then return 'SELLER'; end if;
  if public.is_arbiter()       then return 'ARBITER'; end if;
  return null;
end$$;

-- ---------------------------------------------------------------------------
-- 2. Хардened BEFORE-триггер: нормализация, иммутабельность, валидация ребра
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor  public.escrow_actor;
  v_uid    uuid := auth.uid();
  v_reason text := nullif(current_setting('app.escrow_reason', true), '');
begin
  -- 2.1 DEPRECATED-алиасы легаси-фронтенда -> канонические значения
  if NEW.status = 'FUNDS_HOLD'       then NEW.status := 'ESCROW_HOLD'; end if;
  if NEW.status = 'DATA_TRANSFERRED' then NEW.status := 'VERIFYING';   end if;

  -- 2.2 Иммутабельные поля сделки
  if NEW.escrow_amount is distinct from OLD.escrow_amount
     or NEW.fee_amount is distinct from OLD.fee_amount
     or NEW.listing_id is distinct from OLD.listing_id
     or NEW.buyer_id   is distinct from OLD.buyer_id
     or NEW.seller_id  is distinct from OLD.seller_id
     or NEW.currency   is distinct from OLD.currency
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'Финансовые поля и участники сделки неизменяемы'
      using errcode = 'ESC03';
  end if;

  -- payment_id пишется один раз (вебхуком) и больше не меняется
  if OLD.payment_id is not null and NEW.payment_id is distinct from OLD.payment_id then
    raise exception 'payment_id уже зафиксирован' using errcode = 'ESC03';
  end if;

  NEW.updated_at := now();

  -- 2.3 Статус не менялся — обычный UPDATE полей витрины
  if NEW.status is not distinct from OLD.status then
    NEW.version := OLD.version;
    return NEW;
  end if;

  -- 2.4 Смена статуса: определяем актора и валидируем ребро графа
  v_actor := public.escrow_actor_for(OLD);

  if v_actor is null then
    raise exception 'Недостаточно прав для смены статуса заказа %', OLD.id
      using errcode = 'ESC03';
  end if;

  if public.escrow_is_terminal(OLD.status) then
    raise exception 'Заказ % в терминальном статусе % — изменения запрещены', OLD.id, OLD.status
      using errcode = 'ESC01';
  end if;

  if not public.escrow_transition_allowed(OLD.status, NEW.status, v_actor) then
    raise exception 'Переход % -> % запрещён для роли %', OLD.status, NEW.status, v_actor
      using errcode = 'ESC01',
            detail  = format('order_id=%s actor=%s', OLD.id, coalesce(v_uid::text,'system'));
  end if;

  -- 2.5 Служебные отметки времени
  NEW.version           := OLD.version + 1;
  NEW.status_changed_at := now();

  if NEW.status = 'ESCROW_HOLD' then
    NEW.escrow_held_at := coalesce(NEW.escrow_held_at, now());
    NEW.paid_at        := coalesce(NEW.paid_at, now());
  elsif NEW.status = 'VERIFYING' then
    NEW.delivered_at     := coalesce(NEW.delivered_at, now());
    NEW.auto_complete_at := coalesce(NEW.auto_complete_at, now() + interval '72 hours');
  elsif NEW.status = 'DISPUTE' then
    NEW.dispute_opened_at := coalesce(NEW.dispute_opened_at, now());
    NEW.dispute_reason    := coalesce(v_reason, NEW.dispute_reason);
    NEW.auto_complete_at  := null;             -- авто-релиз замораживается
  elsif NEW.status in ('COMPLETED','REFUNDED') then
    NEW.resolved_at      := coalesce(NEW.resolved_at, now());
    NEW.resolved_by      := coalesce(NEW.resolved_by, v_uid);
    NEW.auto_complete_at := null;
  elsif NEW.status in ('CANCELLED','EXPIRED') then
    NEW.cancel_reason    := coalesce(v_reason, NEW.cancel_reason);
    NEW.auto_complete_at := null;
  end if;

  -- 2.6 Append-only аудит
  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason, metadata)
  values (OLD.id, OLD.status, NEW.status, v_uid, v_actor, v_reason,
          jsonb_build_object('version', NEW.version, 'payment_id', NEW.payment_id));

  return NEW;
end$$;

drop trigger if exists trg_order_transition on public.orders;
create trigger trg_order_transition
  before update on public.orders
  for each row execute function public.enforce_order_transition();

-- Нормализация статуса и на INSERT (легаси-фронтенд шлёт FUNDS_HOLD)
-- ВНИМАНИЕ: функция намеренно SECURITY INVOKER — внутри SECURITY DEFINER
-- current_user подменяется владельцем и проверка доверенной роли ломается.
create or replace function public.normalize_order_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_caller text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
                            current_user);
begin
  if NEW.status = 'FUNDS_HOLD'       then NEW.status := 'ESCROW_HOLD'; end if;
  if NEW.status = 'DATA_TRANSFERRED' then NEW.status := 'VERIFYING';   end if;

  -- КРИТИЧНО: клиент не может «создать» заказ с уже удержанными деньгами.
  -- Денежные статусы доступны только доверенной роли (вебхук/бэкенд).
  if v_caller not in ('service_role', 'postgres', 'supabase_admin')
     and NEW.status not in ('CREATED', 'PENDING_PAYMENT') then
    NEW.status := 'PENDING_PAYMENT';
  end if;

  NEW.version           := 1;
  NEW.status_changed_at := now();
  NEW.updated_at        := now();
  if NEW.status = 'ESCROW_HOLD' then
    NEW.escrow_held_at := coalesce(NEW.escrow_held_at, now());
    NEW.paid_at        := coalesce(NEW.paid_at, now());
  end if;

  return NEW;
end$$;

drop trigger if exists trg_order_normalize on public.orders;
create trigger trg_order_normalize
  before insert on public.orders
  for each row execute function public.normalize_order_insert();

-- Аудит создания заказа (AFTER — иначе FK order_events -> orders не пройдёт)
create or replace function public.audit_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.order_events (order_id, from_status, to_status, actor_id, actor_role, reason)
  values (NEW.id, null, NEW.status, coalesce(auth.uid(), NEW.buyer_id),
          (case when auth.uid() is null then 'SYSTEM' else 'BUYER' end)::public.escrow_actor,
          'order_created');
  return null;
end$$;

drop trigger if exists trg_order_audit_insert on public.orders;
create trigger trg_order_audit_insert
  after insert on public.orders
  for each row execute function public.audit_order_insert();

-- ---------------------------------------------------------------------------
-- 3. Ядро: блокировка строки + оптимистическая версия + переход
-- ---------------------------------------------------------------------------

create or replace function public.escrow_apply_transition(
  p_order_id         uuid,
  p_to               public.order_status,
  p_actor            public.escrow_actor,
  p_reason           text default null,
  p_expected_version integer default null,
  p_patch            jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  -- Пессимистическая блокировка: конкурирующая транзакция ждёт здесь.
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Заказ % не найден', p_order_id using errcode = 'ESC04';
  end if;

  -- Оптимистическая блокировка (клиент прислал версию, которую видел).
  if p_expected_version is not null and v_order.version <> p_expected_version then
    raise exception 'Заказ % изменён другой операцией (версия %, ожидалась %)',
      p_order_id, v_order.version, p_expected_version using errcode = 'ESC02';
  end if;

  -- Идемпотентность на уровне состояния: повторный вызов не ломает поток.
  if v_order.status = p_to then
    return v_order;
  end if;

  perform set_config('app.escrow_actor_role', p_actor::text, true);
  perform set_config('app.escrow_reason', coalesce(p_reason, ''), true);

  update public.orders
     set status           = p_to,
         payment_id       = coalesce(p_patch->>'payment_id', payment_id),
         payment_intent_id= coalesce(p_patch->>'payment_intent_id', payment_intent_id),
         qr_expires_at    = coalesce((p_patch->>'qr_expires_at')::timestamptz, qr_expires_at),
         auto_complete_at = coalesce((p_patch->>'auto_complete_at')::timestamptz, auto_complete_at),
         resolved_by      = coalesce((p_patch->>'resolved_by')::uuid, resolved_by)
   where id = p_order_id
   returning * into v_order;

  perform set_config('app.escrow_actor_role', '', true);
  perform set_config('app.escrow_reason', '', true);

  return v_order;
end$$;

revoke all on function public.escrow_apply_transition(uuid, public.order_status, public.escrow_actor, text, integer, jsonb) from public;

-- Проводка денег (идемпотентна по idempotency_key)
create or replace function public.escrow_post_transaction(
  p_order_id        uuid,
  p_type            public.escrow_tx_type,
  p_amount_minor    bigint,
  p_idempotency_key text,
  p_actor_id        uuid default null,
  p_actor_role      public.escrow_actor default 'SYSTEM',
  p_provider_payment_id text default null,
  p_provider_event_id   text default null,
  p_metadata        jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    return null;                              -- нулевая комиссия/выплата не проводится
  end if;

  insert into public.transactions (
    order_id, type, status, amount_minor, provider_payment_id, provider_event_id,
    idempotency_key, actor_id, actor_role, metadata, posted_at
  ) values (
    p_order_id, p_type, 'POSTED', p_amount_minor, p_provider_payment_id, p_provider_event_id,
    p_idempotency_key, p_actor_id, p_actor_role, p_metadata, now()
  )
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.transactions where idempotency_key = p_idempotency_key;
  end if;

  return v_id;
end$$;

revoke all on function public.escrow_post_transaction(uuid, public.escrow_tx_type, bigint, text, uuid, public.escrow_actor, text, text, jsonb) from public;

-- Терминальная расчётная операция
create or replace function public.escrow_settle(
  p_order      public.orders,
  p_outcome    public.order_status,
  p_actor_id   uuid,
  p_actor_role public.escrow_actor
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_outcome = 'COMPLETED' then
    perform public.escrow_post_transaction(
      p_order.id, 'FEE', p_order.fee_minor, 'fee:' || p_order.id,
      p_actor_id, p_actor_role, p_order.payment_id, null,
      jsonb_build_object('rate', 0.05));
    perform public.escrow_post_transaction(
      p_order.id, 'PAYOUT', p_order.payout_minor, 'payout:' || p_order.id,
      p_actor_id, p_actor_role, p_order.payment_id, null,
      jsonb_build_object('beneficiary', p_order.seller_id));
  elsif p_outcome = 'REFUNDED' then
    perform public.escrow_post_transaction(
      p_order.id, 'REFUND', p_order.total_minor, 'refund:' || p_order.id,
      p_actor_id, p_actor_role, p_order.payment_id, null,
      jsonb_build_object('beneficiary', p_order.buyer_id));
  end if;
end$$;

revoke all on function public.escrow_settle(public.orders, public.order_status, uuid, public.escrow_actor) from public;

-- Гарантия целостности денег НЕЗАВИСИМО от пути перехода (RPC, легаси-UPDATE,
-- cron): любой вход в терминальный денежный статус порождает проводки.
create or replace function public.tg_settle_on_terminal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.status in ('COMPLETED','REFUNDED') and OLD.status is distinct from NEW.status then
    perform public.escrow_settle(NEW, NEW.status, auth.uid(),
      coalesce(nullif(current_setting('app.escrow_actor_role', true), '')::public.escrow_actor, 'SYSTEM'));
  end if;
  return null;
end$$;

drop trigger if exists trg_order_settle on public.orders;
create trigger trg_order_settle
  after update of status on public.orders
  for each row execute function public.tg_settle_on_terminal();

-- ---------------------------------------------------------------------------
-- 4. RPC: вебхук Kaspi QR (service_role) — строго идемпотентный
-- ---------------------------------------------------------------------------

create or replace function public.kaspi_webhook_capture(
  p_event_id     text,
  p_event_type   text,
  p_order_id     uuid,
  p_payment_id   text,
  p_amount_minor bigint,
  p_raw          jsonb,
  p_signature    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hook_id bigint;
  v_order   public.orders;
  v_tx      uuid;
begin
  if p_event_id is null or length(p_event_id) = 0 then
    raise exception 'event_id обязателен' using errcode = 'ESC05';
  end if;

  -- 4.1 Слой идемпотентности: UNIQUE(provider, event_id).
  insert into public.payment_webhooks (provider, event_id, event_type, order_id, payment_id,
                                       amount_minor, signature, raw, status)
  values ('KASPI_QR', p_event_id, p_event_type, p_order_id, p_payment_id,
          p_amount_minor, p_signature, coalesce(p_raw, '{}'::jsonb), 'RECEIVED')
  on conflict (provider, event_id) do nothing
  returning id into v_hook_id;

  if v_hook_id is null then
    update public.payment_webhooks
       set attempts = attempts + 1
     where provider = 'KASPI_QR' and event_id = p_event_id;

    select * into v_order from public.orders where id = p_order_id;
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'reason', 'DUPLICATE_EVENT',
      'order_id', p_order_id, 'status', v_order.status, 'version', v_order.version);
  end if;

  -- 4.2 Блокировка заказа
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    update public.payment_webhooks
       set status = 'REJECTED', error_code = 'ORDER_NOT_FOUND', processed_at = now()
     where id = v_hook_id;
    return jsonb_build_object('ok', false, 'error', 'ORDER_NOT_FOUND', 'order_id', p_order_id);
  end if;

  -- 4.3 Сверка суммы (защита от подмены/недоплаты)
  if p_amount_minor is distinct from v_order.total_minor then
    update public.payment_webhooks
       set status = 'REJECTED', error_code = 'AMOUNT_MISMATCH', processed_at = now()
     where id = v_hook_id;
    return jsonb_build_object('ok', false, 'error', 'AMOUNT_MISMATCH',
      'expected_minor', v_order.total_minor, 'received_minor', p_amount_minor,
      'order_id', p_order_id, 'status', v_order.status);
  end if;

  -- 4.4 Повторная оплата уже удержанного заказа — no-op
  if v_order.status <> 'CREATED' and v_order.status <> 'PENDING_PAYMENT' then
    update public.payment_webhooks
       set status = 'DUPLICATE', error_code = 'ALREADY_SETTLED', processed_at = now()
     where id = v_hook_id;
    return jsonb_build_object('ok', true, 'idempotent', true, 'reason', 'ALREADY_IN_STATE',
      'order_id', p_order_id, 'status', v_order.status, 'version', v_order.version);
  end if;

  -- 4.5 Переход в ESCROW_HOLD + проводка HOLD
  v_order := public.escrow_apply_transition(
    p_order_id, 'ESCROW_HOLD', 'SYSTEM',
    'kaspi:' || p_event_id, null,
    jsonb_build_object('payment_id', p_payment_id));

  v_tx := public.escrow_post_transaction(
    p_order_id, 'HOLD', p_amount_minor, 'kaspi:' || p_event_id,
    null, 'SYSTEM', p_payment_id, p_event_id,
    jsonb_build_object('event_type', p_event_type));

  update public.payment_webhooks
     set status = 'PROCESSED', processed_at = now()
   where id = v_hook_id;

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version, 'transaction_id', v_tx);
end$$;

revoke all on function public.kaspi_webhook_capture(text, text, uuid, text, bigint, jsonb, text) from public;
grant execute on function public.kaspi_webhook_capture(text, text, uuid, text, bigint, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. RPC участников сделки (authenticated)
-- ---------------------------------------------------------------------------

-- 5.1 Покупатель подтверждает сделку -> COMPLETED (+ FEE/PAYOUT)
create or replace function public.buyer_confirm_order(
  p_order_id         uuid,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Требуется авторизация' using errcode = 'ESC03';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;
  if v_order.buyer_id is distinct from v_uid then
    raise exception 'Подтвердить сделку может только покупатель' using errcode = 'ESC03';
  end if;
  if v_order.status = 'DISPUTE' then
    raise exception 'По заказу открыт спор — решение принимает арбитраж' using errcode = 'ESC01';
  end if;
  if v_order.status = 'COMPLETED' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'order_id', p_order_id,
      'status', v_order.status, 'version', v_order.version);
  end if;

  v_order := public.escrow_apply_transition(
    p_order_id, 'COMPLETED', 'BUYER', 'buyer_confirmed', p_expected_version,
    jsonb_build_object('resolved_by', v_uid));

  perform public.escrow_settle(v_order, 'COMPLETED', v_uid, 'BUYER');

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version);
end$$;

-- 5.2 Продавец передал данные -> VERIFYING
create or replace function public.seller_mark_delivered(
  p_order_id         uuid,
  p_summary          text default null,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;
  if v_order.seller_id is distinct from v_uid then
    raise exception 'Только продавец отмечает передачу данных' using errcode = 'ESC03';
  end if;

  v_order := public.escrow_apply_transition(
    p_order_id, 'VERIFYING', 'SELLER', coalesce(p_summary, 'seller_delivered'), p_expected_version,
    jsonb_build_object('auto_complete_at', (now() + interval '72 hours')::text));

  return jsonb_build_object('ok', true, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version,
    'auto_complete_at', v_order.auto_complete_at);
end$$;

-- 5.3 Открытие спора (покупатель или продавец)
create or replace function public.open_dispute(
  p_order_id         uuid,
  p_reason           text,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
  v_role  public.escrow_actor;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;

  if v_uid = v_order.buyer_id then
    v_role := 'BUYER';
  elsif v_uid = v_order.seller_id then
    v_role := 'SELLER';
  else
    raise exception 'Спор может открыть только участник сделки' using errcode = 'ESC03';
  end if;

  if coalesce(length(btrim(p_reason)), 0) < 10 then
    raise exception 'Опишите причину спора (минимум 10 символов)' using errcode = 'ESC05';
  end if;

  v_order := public.escrow_apply_transition(
    p_order_id, 'DISPUTE', v_role, p_reason, p_expected_version);

  return jsonb_build_object('ok', true, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version);
end$$;

-- 5.4 Арбитр закрывает спор
create or replace function public.arbiter_resolve_dispute(
  p_order_id         uuid,
  p_outcome          text,                    -- 'COMPLETED' | 'REFUNDED'
  p_reason           text,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_order   public.orders;
  v_outcome public.order_status;
begin
  if not public.is_arbiter() then
    raise exception 'Требуется роль арбитра' using errcode = 'ESC03';
  end if;
  if p_outcome not in ('COMPLETED','REFUNDED') then
    raise exception 'Недопустимый исход спора: %', p_outcome using errcode = 'ESC05';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 10 then
    raise exception 'Решение арбитра требует обоснования' using errcode = 'ESC05';
  end if;

  v_outcome := p_outcome::public.order_status;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;
  if v_order.status <> 'DISPUTE' then
    raise exception 'Арбитраж применим только к заказам в статусе DISPUTE' using errcode = 'ESC01';
  end if;

  v_order := public.escrow_apply_transition(
    p_order_id, v_outcome, 'ARBITER', p_reason, p_expected_version,
    jsonb_build_object('resolved_by', v_uid));

  perform public.escrow_settle(v_order, v_outcome, v_uid, 'ARBITER');

  return jsonb_build_object('ok', true, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version);
end$$;

-- 5.5 Создание заказа и привязка платёжного намерения Kaspi
create or replace function public.escrow_create_order(
  p_listing_id      uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    raise exception 'Требуется авторизация' using errcode = 'ESC03';
  end if;

  select * into v_order from public.orders
   where idempotency_key = p_idempotency_key and buyer_id = v_uid;
  if found then
    return jsonb_build_object('ok', true, 'idempotent', true, 'order_id', v_order.id,
      'status', v_order.status, 'version', v_order.version, 'total_minor', v_order.total_minor);
  end if;

  insert into public.orders (listing_id, buyer_id, status, idempotency_key, escrow_amount, fee_amount)
  values (p_listing_id, v_uid, 'CREATED', p_idempotency_key, 0, 0)
  returning * into v_order;     -- суммы проставит trg_fill_order из листинга

  if v_order.seller_id = v_uid then
    raise exception 'Нельзя купить собственный лот' using errcode = 'ESC03';
  end if;

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', v_order.id,
    'status', v_order.status, 'version', v_order.version, 'total_minor', v_order.total_minor);
end$$;

create or replace function public.escrow_attach_payment_intent(
  p_order_id     uuid,
  p_intent_id    text,
  p_qr_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;
  if v_order.buyer_id is distinct from v_uid then
    raise exception 'Нет доступа к заказу' using errcode = 'ESC03';
  end if;

  v_order := public.escrow_apply_transition(
    p_order_id, 'PENDING_PAYMENT', 'BUYER', 'kaspi_qr_issued', null,
    jsonb_build_object('payment_intent_id', p_intent_id,
                       'qr_expires_at', p_qr_expires_at::text));

  return jsonb_build_object('ok', true, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version);
end$$;

-- ---------------------------------------------------------------------------
-- 6. Фоновые задачи (service_role / pg_cron)
-- ---------------------------------------------------------------------------

create or replace function public.escrow_run_slas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec      record;
  v_expired  int := 0;
  v_released int := 0;
begin
  -- 6.1 Протухшие QR
  for v_rec in
    select id from public.orders
     where status = 'PENDING_PAYMENT'
       and qr_expires_at is not null
       and qr_expires_at < now()
     order by qr_expires_at
     limit 500
     for update skip locked
  loop
    perform public.escrow_apply_transition(v_rec.id, 'EXPIRED', 'SYSTEM', 'qr_expired');
    v_expired := v_expired + 1;
  end loop;

  -- 6.2 Авто-релиз средств продавцу по истечении SLA проверки
  for v_rec in
    select id from public.orders
     where status = 'VERIFYING'
       and auto_complete_at is not null
       and auto_complete_at < now()
     order by auto_complete_at
     limit 500
     for update skip locked
  loop
    perform public.escrow_settle(
      public.escrow_apply_transition(v_rec.id, 'COMPLETED', 'SYSTEM', 'auto_release_sla'),
      'COMPLETED', null, 'SYSTEM');
    v_released := v_released + 1;
  end loop;

  return jsonb_build_object('expired', v_expired, 'auto_released', v_released, 'ran_at', now());
end$$;

revoke all on function public.escrow_run_slas() from public;
grant execute on function public.escrow_run_slas() to service_role;

-- ---------------------------------------------------------------------------
-- 7. Гранты RPC
-- ---------------------------------------------------------------------------

revoke all on function public.buyer_confirm_order(uuid, integer)                       from public;
revoke all on function public.seller_mark_delivered(uuid, text, integer)               from public;
revoke all on function public.open_dispute(uuid, text, integer)                        from public;
revoke all on function public.arbiter_resolve_dispute(uuid, text, text, integer)       from public;
revoke all on function public.escrow_create_order(uuid, text)                          from public;
revoke all on function public.escrow_attach_payment_intent(uuid, text, timestamptz)    from public;

grant execute on function public.buyer_confirm_order(uuid, integer)                    to authenticated, service_role;
grant execute on function public.seller_mark_delivered(uuid, text, integer)            to authenticated, service_role;
grant execute on function public.open_dispute(uuid, text, integer)                     to authenticated, service_role;
grant execute on function public.arbiter_resolve_dispute(uuid, text, text, integer)    to authenticated, service_role;
grant execute on function public.escrow_create_order(uuid, text)                       to authenticated, service_role;
grant execute on function public.escrow_attach_payment_intent(uuid, text, timestamptz) to authenticated, service_role;

commit;
