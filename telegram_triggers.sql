-- ============================================================
-- tenge.gg — Telegram-уведомления через Database Webhooks
-- Запустить в Supabase SQL Editor, подставив 2 переменные ниже.
-- ============================================================

-- 1. Расширение для HTTP-запросов из Postgres
create extension if not exists pg_net;

-- 2. Конфигурация (ЗАМЕНИ ЗНАЧЕНИЯ!)
-- Храним в защищённой таблице настроек, чтобы не светить токен в коде функций
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

insert into app_settings (key, value) values
  ('telegram_bot_token', '8420205890:AAGMjj8W0Qyr_vFwmBSHeFd0P-xnW4ySB0Y'),
  ('telegram_chat_id',   '6462720255')
on conflict (key) do update set value = excluded.value;

-- 3. Универсальная функция отправки в Telegram
create or replace function tg_send(message text)
returns void
language plpgsql
security definer
as $$
declare
  v_token text;
  v_chat  text;
begin
  select value into v_token from app_settings where key = 'telegram_bot_token';
  select value into v_chat  from app_settings where key = 'telegram_chat_id';

  perform net.http_post(
    url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
                 'chat_id',    v_chat,
                 'text',       message,
                 'parse_mode', 'Markdown'
               )
  );
end;
$$;

-- ============================================================
-- 4. ТРИГГЕР: новая заявка с лендинга (early_leads)
-- ============================================================
create or replace function notify_new_lead()
returns trigger
language plpgsql
security definer
as $$
begin
  perform tg_send(
    '🔔 *Новая заявка на альфа-тест!*' || E'\n' ||
    'Контакт: `' || NEW.contact || '`' || E'\n' ||
    'Роль: `' || NEW.role || '`' || E'\n' ||
    'Дата: `' || to_char(NEW.created_at at time zone 'Asia/Almaty', 'DD.MM.YYYY HH24:MI') || '`'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_new_lead on early_leads;
create trigger trg_new_lead
  after insert on early_leads
  for each row
  execute function notify_new_lead();

-- ============================================================
-- 5. ТРИГГЕР: новые сделки и споры (orders)
-- ============================================================
create or replace function notify_order_event()
returns trigger
language plpgsql
security definer
as $$
begin
  -- INSERT: новая escrow-сделка (оплата Kaspi QR)
  if TG_OP = 'INSERT' and NEW.status = 'FUNDS_HOLD' then
    perform tg_send(
      '💰 *Новая Escrow-сделка!*' || E'\n' ||
      'ID заказа: `' || NEW.id || '`' || E'\n' ||
      'Сумма: `' || NEW.escrow_amount || ' ₸` (комиссия: `' || NEW.fee_amount || ' ₸`)' || E'\n' ||
      'Покупатель: `' || coalesce(NEW.buyer_id::text, 'anon') || '`' || E'\n' ||
      'Ожидается передача данных продавцом.'
    );
  end if;

  -- UPDATE: открыт спор
  if TG_OP = 'UPDATE' and NEW.status = 'DISPUTE' and OLD.status is distinct from 'DISPUTE' then
    perform tg_send(
      '🚨 *ОТКРЫТ СПОР!*' || E'\n' ||
      'Заказ: `' || NEW.id || '`' || E'\n' ||
      'Арбитраж требуется. Проверьте панель управления.'
    );
  end if;

  -- UPDATE: сделка завершена (выплата продавцу)
  if TG_OP = 'UPDATE' and NEW.status = 'COMPLETED' and OLD.status is distinct from 'COMPLETED' then
    perform tg_send(
      '✅ *Сделка завершена*' || E'\n' ||
      'Заказ: `' || NEW.id || '`' || E'\n' ||
      'Выплата продавцу: `' || (NEW.escrow_amount - NEW.fee_amount) || ' ₸`'
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_order_event on orders;
create trigger trg_order_event
  after insert or update on orders
  for each row
  execute function notify_order_event();

-- ============================================================
-- 6. Проверка: тестовое сообщение
-- ============================================================
select tg_send('🌕 *tenge.gg*: Telegram-уведомления подключены и работают!');

-- ============================================================
-- 7. УВЕДОМЛЕНИЕ ПРОДАВЦУ О ПОКУПКЕ
-- «У тебя купили PUBG 660 UC! Зайди в кабинет и передай данные»
-- ============================================================
create or replace function notify_seller_sold()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_price numeric;
begin
  if TG_OP = 'INSERT' and NEW.status = 'FUNDS_HOLD' then
    select title, price into v_title, v_price
      from listings where id = NEW.listing_id;

    perform tg_send(
      '📢 *У ТЕБЯ КУПИЛИ ЛОТ!*' || E'\n\n' ||
      '🎮 Товар: *' || coalesce(v_title, 'лот без названия') || '*' || E'\n' ||
      '💰 Сумма сделки: `' || NEW.escrow_amount || ' ₸`' || E'\n' ||
      '📉 Комиссия 5%: `' || NEW.fee_amount || ' ₸`' || E'\n' ||
      '✅ К выплате тебе: `' || (NEW.escrow_amount - NEW.fee_amount) || ' ₸`' || E'\n\n' ||
      '⏰ *Действие:* зайди в личный кабинет и передай данные покупателю в чате сделки.' || E'\n' ||
      '🎥 Обязательно запиши видео передачи — это твоя защита в арбитраже.' || E'\n\n' ||
      '🔗 Заказ: `' || NEW.id || '`'
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_seller_sold on orders;
create trigger trg_seller_sold
  after insert on orders
  for each row
  execute function notify_seller_sold();

-- Проверка нового триггера
select tg_send('🔔 *tenge.gg*: уведомления продавцам о продажах активированы!');
