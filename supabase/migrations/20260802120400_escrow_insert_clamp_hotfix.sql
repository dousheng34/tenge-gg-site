-- ============================================================================
-- tenge.gg — Escrow :: 05 HOTFIX
--   1) normalize_order_insert() -> SECURITY INVOKER (внутри SECURITY DEFINER
--      current_user равен владельцу, и клиентский INSERT со статусом
--      ESCROW_HOLD проходил мимо проверки доверенной роли);
--   2) audit_order_insert(): явное приведение actor_role к enum;
--   3) граф переходов: SYSTEM может зафиксировать оплату по заказу в CREATED
--      (вебхук Kaspi пришёл раньше, чем привязан payment_intent).
-- ============================================================================

begin;

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


commit;
