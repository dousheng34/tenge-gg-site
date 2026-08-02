-- ============================================================================
-- tenge.gg — Escrow State Machine :: 04 OPS & COMPAT
--   * Telegram-уведомления переведены на канонические статусы
--   * Ручное подтверждение оплаты Kaspi администратором (пока нет API-ключа)
--   * Служебная вьюха для арбитражной панели
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Telegram-триггеры под ENUM
-- ---------------------------------------------------------------------------

create or replace function public.notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'UPDATE' and NEW.status = 'ESCROW_HOLD' and OLD.status is distinct from 'ESCROW_HOLD' then
    perform public.tg_send(
      '💰 *Escrow: деньги на транзитном счёте*' || E'\n' ||
      'Заказ: `' || NEW.id || '`' || E'\n' ||
      'Сумма: `' || NEW.escrow_amount || ' ₸` (комиссия `' || NEW.fee_amount || ' ₸`)' || E'\n' ||
      'Kaspi payment: `' || coalesce(NEW.payment_id, '—') || '`' || E'\n' ||
      'Ожидается передача данных продавцом.');
  end if;

  if TG_OP = 'UPDATE' and NEW.status = 'VERIFYING' and OLD.status is distinct from 'VERIFYING' then
    perform public.tg_send(
      '📦 *Данные переданы* — заказ `' || NEW.id || '`' || E'\n' ||
      'Авто-релиз: `' || to_char(NEW.auto_complete_at at time zone 'Asia/Almaty', 'DD.MM HH24:MI') || '`');
  end if;

  if TG_OP = 'UPDATE' and NEW.status = 'DISPUTE' and OLD.status is distinct from 'DISPUTE' then
    perform public.tg_send(
      '🚨 *ОТКРЫТ СПОР!*' || E'\n' ||
      'Заказ: `' || NEW.id || '`' || E'\n' ||
      'Причина: ' || coalesce(NEW.dispute_reason, '—') || E'\n' ||
      'Требуется арбитраж.');
  end if;

  if TG_OP = 'UPDATE' and NEW.status = 'COMPLETED' and OLD.status is distinct from 'COMPLETED' then
    perform public.tg_send(
      '✅ *Сделка завершена* — заказ `' || NEW.id || '`' || E'\n' ||
      'Выплата продавцу: `' || (NEW.escrow_amount - NEW.fee_amount) || ' ₸`');
  end if;

  if TG_OP = 'UPDATE' and NEW.status = 'REFUNDED' and OLD.status is distinct from 'REFUNDED' then
    perform public.tg_send(
      '↩️ *Возврат покупателю* — заказ `' || NEW.id || '`' || E'\n' ||
      'Сумма: `' || NEW.escrow_amount || ' ₸`');
  end if;

  return NEW;
end$$;

create or replace function public.notify_seller_sold()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
begin
  if NEW.status in ('PENDING_PAYMENT','ESCROW_HOLD') then
    select title into v_title from public.listings where id = NEW.listing_id;
    perform public.tg_send(
      '📢 *НОВЫЙ ЗАКАЗ НА ТВОЙ ЛОТ*' || E'\n\n' ||
      '🎮 Товар: *' || coalesce(v_title, 'лот без названия') || '*' || E'\n' ||
      '💰 Сумма сделки: `' || NEW.escrow_amount || ' ₸`' || E'\n' ||
      '📉 Комиссия 5%: `' || NEW.fee_amount || ' ₸`' || E'\n' ||
      '✅ К выплате: `' || (NEW.escrow_amount - NEW.fee_amount) || ' ₸`' || E'\n\n' ||
      '⏰ Передавай данные ТОЛЬКО после статуса ESCROW_HOLD.' || E'\n' ||
      '🎥 Записывай видео передачи — это защита в арбитраже.' || E'\n\n' ||
      '🔗 Заказ: `' || NEW.id || '`');
  end if;
  return NEW;
end$$;

-- ---------------------------------------------------------------------------
-- 2. Ручное подтверждение оплаты Kaspi (до подключения боевого API)
--    Работает как SYSTEM-переход, требует роль admin, полностью аудируется.
-- ---------------------------------------------------------------------------

create or replace function public.admin_confirm_manual_payment(
  p_order_id   uuid,
  p_payment_id text,
  p_reason     text default 'manual_kaspi_confirmation'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_uid   uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Требуется роль admin' using errcode = 'ESC03';
  end if;
  if coalesce(length(btrim(p_payment_id)), 0) < 4 then
    raise exception 'Укажите идентификатор платежа Kaspi' using errcode = 'ESC05';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Заказ не найден' using errcode = 'ESC04';
  end if;
  if v_order.status = 'ESCROW_HOLD' then
    return jsonb_build_object('ok', true, 'idempotent', true, 'order_id', p_order_id,
      'status', v_order.status, 'version', v_order.version);
  end if;

  insert into public.payment_webhooks (provider, event_id, event_type, order_id, payment_id,
                                       amount_minor, raw, status, processed_at)
  values ('MANUAL', 'manual:' || p_order_id, 'MANUAL_CONFIRMATION', p_order_id, p_payment_id,
          v_order.total_minor, jsonb_build_object('actor', v_uid, 'reason', p_reason),
          'PROCESSED', now())
  on conflict (provider, event_id) do nothing;

  v_order := public.escrow_apply_transition(
    p_order_id, 'ESCROW_HOLD', 'SYSTEM', p_reason, null,
    jsonb_build_object('payment_id', p_payment_id));

  perform public.escrow_post_transaction(
    p_order_id, 'HOLD', v_order.total_minor, 'manual:' || p_order_id,
    v_uid, 'ARBITER', p_payment_id, null, jsonb_build_object('manual', true));

  return jsonb_build_object('ok', true, 'idempotent', false, 'order_id', p_order_id,
    'status', v_order.status, 'version', v_order.version);
end$$;

revoke all on function public.admin_confirm_manual_payment(uuid, text, text) from public;
grant execute on function public.admin_confirm_manual_payment(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Вьюха арбитражной очереди (RLS наследуется от orders: security_invoker)
-- ---------------------------------------------------------------------------

create or replace view public.dispute_queue
with (security_invoker = true) as
select
  o.id,
  o.status,
  o.version,
  o.listing_title,
  o.escrow_amount,
  o.fee_amount,
  o.total_minor,
  o.buyer_id,
  o.seller_id,
  o.dispute_opened_at,
  o.dispute_reason,
  now() - o.dispute_opened_at as age,
  (select count(*) from public.trade_messages m where m.order_id = o.id) as messages
from public.orders o
where o.status = 'DISPUTE'::public.order_status;

grant select on public.dispute_queue to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Планировщик SLA (опционально; выполнить при включённом pg_cron)
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron with schema extensions;
-- select cron.schedule('escrow-slas', '*/5 * * * *', $$select public.escrow_run_slas();$$);

commit;
