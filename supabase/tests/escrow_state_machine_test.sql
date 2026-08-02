-- ============================================================================
-- tenge.gg — интеграционный тест escrow-стейт-машины.
-- Запуск: psql -f escrow_state_machine_test.sql (или Supabase SQL Editor).
-- Скрипт создаёт и удаляет собственные данные, боевые строки не трогает.
-- ============================================================================

drop table if exists public._escrow_test_log;
create table public._escrow_test_log (n serial primary key, name text, result text, detail text);

do $$
declare
  v_buyer   uuid := '11111111-1111-4111-8111-111111111111';
  v_seller  uuid := '22222222-2222-4222-8222-222222222222';
  v_arb     uuid := '33333333-3333-4333-8333-333333333333';
  v_alien   uuid := '44444444-4444-4444-8444-444444444444';
  v_order   uuid;
  v_order2  uuid;
  v_res     jsonb;
  v_status  public.order_status;
  v_cnt     int;
  v_ver     int;
begin
  -- fixtures ---------------------------------------------------------------
  insert into public.user_roles(user_id, role) values (v_arb, 'arbiter')
    on conflict (user_id) do update set role = 'arbiter';

  -- Заказы создаются без listing_id, чтобы тест не трогал боевой каталог
  -- и статистику продавцов (trg_fill_order срабатывает только при listing_id).

  -- 1. Клиентский INSERT не может создать заказ с удержанными деньгами -------
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer, 'role','authenticated')::text, false);
  set local role authenticated;

  insert into public.orders (buyer_id, seller_id, status, escrow_amount, fee_amount, listing_title)
  values (v_buyer, v_seller, 'FUNDS_HOLD', 10000, 500, 'TEST LOT escrow')
  returning id, status into v_order, v_status;

  reset role;
  insert into public._escrow_test_log(name, result, detail)
  values ('01 insert clamped to PENDING_PAYMENT',
          case when v_status = 'PENDING_PAYMENT' then 'PASS' else 'FAIL' end, v_status::text);

  -- 2. Вебхук Kaspi: первый вызов удерживает деньги -------------------------
  v_res := public.kaspi_webhook_capture('evt_1','payment.completed', v_order, 'kaspi_pay_1',
             1000000, '{"src":"test"}'::jsonb, 'sig');
  insert into public._escrow_test_log(name, result, detail)
  values ('02 webhook -> ESCROW_HOLD',
          case when v_res->>'status' = 'ESCROW_HOLD' and (v_res->>'ok')::bool then 'PASS' else 'FAIL' end,
          v_res::text);

  -- 3. Повторная доставка того же события — строгая идемпотентность ---------
  v_res := public.kaspi_webhook_capture('evt_1','payment.completed', v_order, 'kaspi_pay_1',
             1000000, '{"src":"test"}'::jsonb, 'sig');
  select count(*) into v_cnt from public.transactions where order_id = v_order and type = 'HOLD';
  insert into public._escrow_test_log(name, result, detail)
  values ('03 webhook replay idempotent (1 HOLD)',
          case when (v_res->>'idempotent')::bool and v_cnt = 1 then 'PASS' else 'FAIL' end,
          'holds=' || v_cnt || ' ' || v_res::text);

  -- 4. Несовпадение суммы отклоняется, статус не меняется -------------------
  v_res := public.kaspi_webhook_capture('evt_2','payment.completed', v_order, 'kaspi_pay_2',
             999, '{"src":"test"}'::jsonb, 'sig');
  select status into v_status from public.orders where id = v_order;
  insert into public._escrow_test_log(name, result, detail)
  values ('04 amount mismatch rejected',
          case when v_res->>'error' = 'AMOUNT_MISMATCH' and v_status = 'ESCROW_HOLD' then 'PASS' else 'FAIL' end,
          v_res::text);

  -- 5. Покупатель не может отметить передачу данных за продавца -------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer)::text, false);
  begin
    v_res := public.seller_mark_delivered(v_order, 'hack');
    insert into public._escrow_test_log(name, result, detail) values ('05 buyer cannot deliver','FAIL', v_res::text);
  exception when sqlstate 'ESC03' then
    insert into public._escrow_test_log(name, result, detail) values ('05 buyer cannot deliver','PASS', sqlerrm);
  end;

  -- 6. Продавец передаёт данные -> VERIFYING, ставится SLA -------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_seller)::text, false);
  v_res := public.seller_mark_delivered(v_order, 'логин/пароль в чате');
  insert into public._escrow_test_log(name, result, detail)
  values ('06 seller -> VERIFYING + auto_complete_at',
          case when v_res->>'status' = 'VERIFYING' and v_res->>'auto_complete_at' is not null then 'PASS' else 'FAIL' end,
          v_res::text);

  -- 7. Оптимистическая блокировка: устаревшая версия отклоняется ------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer)::text, false);
  begin
    v_res := public.buyer_confirm_order(v_order, 1);
    insert into public._escrow_test_log(name, result, detail) values ('07 stale version rejected','FAIL', v_res::text);
  exception when sqlstate 'ESC02' then
    insert into public._escrow_test_log(name, result, detail) values ('07 stale version rejected','PASS', sqlerrm);
  end;

  -- 8. Покупатель открывает спор --------------------------------------------
  v_res := public.open_dispute(v_order, 'Аккаунт улетел в бан через час после передачи');
  insert into public._escrow_test_log(name, result, detail)
  values ('08 buyer opens dispute',
          case when v_res->>'status' = 'DISPUTE' then 'PASS' else 'FAIL' end, v_res::text);

  -- 9. Во время спора вывод денег невозможен (гонка «подтвердить в споре») ---
  begin
    v_res := public.buyer_confirm_order(v_order);
    insert into public._escrow_test_log(name, result, detail) values ('09 confirm blocked in DISPUTE','FAIL', v_res::text);
  exception when sqlstate 'ESC01' then
    insert into public._escrow_test_log(name, result, detail) values ('09 confirm blocked in DISPUTE','PASS', sqlerrm);
  end;

  -- 10. Прямой UPDATE в обход RPC тоже блокируется триггером ----------------
  begin
    set local role authenticated;
    update public.orders set status = 'COMPLETED' where id = v_order;
    reset role;
    insert into public._escrow_test_log(name, result, detail) values ('10 raw UPDATE blocked in DISPUTE','FAIL','update passed');
  exception when others then
    reset role;
    insert into public._escrow_test_log(name, result, detail)
      values ('10 raw UPDATE blocked in DISPUTE', case when sqlstate in ('ESC01','ESC03','42501') then 'PASS' else 'FAIL' end,
              sqlstate || ' ' || sqlerrm);
  end;

  -- 11. Продавец не может «переписать» сумму сделки -------------------------
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_seller)::text, false);
    set local role authenticated;
    update public.orders set escrow_amount = 1 where id = v_order;
    reset role;
    insert into public._escrow_test_log(name, result, detail) values ('11 amount tampering blocked','FAIL','update passed');
  exception when others then
    reset role;
    insert into public._escrow_test_log(name, result, detail)
      values ('11 amount tampering blocked', case when sqlstate in ('ESC03','42501') then 'PASS' else 'FAIL' end,
              sqlstate || ' ' || sqlerrm);
  end;

  -- 12. Посторонний пользователь не видит чужую сделку (RLS) ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_alien)::text, false);
  set local role authenticated;
  select count(*) into v_cnt from public.orders where id = v_order;
  reset role;
  insert into public._escrow_test_log(name, result, detail)
  values ('12 RLS: alien sees nothing', case when v_cnt = 0 then 'PASS' else 'FAIL' end, 'rows=' || v_cnt);

  -- 13. Продавец видит свою продажу, покупатель — свою покупку --------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_seller)::text, false);
  set local role authenticated;
  select count(*) into v_cnt from public.orders where id = v_order;
  reset role;
  insert into public._escrow_test_log(name, result, detail)
  values ('13 RLS: seller sees own sale', case when v_cnt = 1 then 'PASS' else 'FAIL' end, 'rows=' || v_cnt);

  -- 14. Арбитр видит спорную сделку -----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_arb)::text, false);
  set local role authenticated;
  select count(*) into v_cnt from public.orders where id = v_order;
  reset role;
  insert into public._escrow_test_log(name, result, detail)
  values ('14 RLS: arbiter sees DISPUTE', case when v_cnt = 1 then 'PASS' else 'FAIL' end, 'rows=' || v_cnt);

  -- 15. …и НЕ видит обычную сделку ------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer)::text, false);
  set local role authenticated;
  insert into public.orders (buyer_id, seller_id, status, escrow_amount, fee_amount, listing_title)
  values (v_buyer, v_seller, 'CREATED', 10000, 500, 'TEST LOT escrow 2')
    returning id into v_order2;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_arb)::text, false);
  set local role authenticated;
  select count(*) into v_cnt from public.orders where id = v_order2;
  reset role;
  insert into public._escrow_test_log(name, result, detail)
  values ('15 RLS: arbiter blind to non-dispute', case when v_cnt = 0 then 'PASS' else 'FAIL' end, 'rows=' || v_cnt);

  -- 16. Арбитр закрывает спор в пользу покупателя -> REFUND -----------------
  v_res := public.arbiter_resolve_dispute(v_order, 'REFUNDED', 'Продавец не предоставил доказательств передачи');
  select count(*) into v_cnt from public.transactions where order_id = v_order and type = 'REFUND';
  insert into public._escrow_test_log(name, result, detail)
  values ('16 arbiter refund + ledger',
          case when v_res->>'status' = 'REFUNDED' and v_cnt = 1 then 'PASS' else 'FAIL' end,
          'refunds=' || v_cnt || ' ' || v_res::text);

  -- 17. Терминальный статус необратим ---------------------------------------
  begin
    v_res := public.buyer_confirm_order(v_order);
    insert into public._escrow_test_log(name, result, detail) values ('17 terminal is final','FAIL', v_res::text);
  exception when others then
    insert into public._escrow_test_log(name, result, detail)
      values ('17 terminal is final', case when sqlstate in ('ESC01','ESC03') then 'PASS' else 'FAIL' end, sqlstate || ' ' || sqlerrm);
  end;

  -- 18. Двойная выплата невозможна (уникальный индекс на расчёт) ------------
  begin
    perform public.escrow_post_transaction(v_order, 'PAYOUT', 950000, 'payout:duplicate-attempt', null, 'SYSTEM');
    insert into public._escrow_test_log(name, result, detail) values ('18 double settlement blocked','FAIL','inserted');
  exception when unique_violation then
    insert into public._escrow_test_log(name, result, detail) values ('18 double settlement blocked','PASS', sqlerrm);
  end;

  -- 19. Полный happy-path: оплата -> передача -> подтверждение -> выплата ----
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer)::text, false);
  v_res := public.kaspi_webhook_capture('evt_3','payment.completed', v_order2, 'kaspi_pay_3',
             1000000, '{"src":"test"}'::jsonb, 'sig');
  perform set_config('request.jwt.claims', json_build_object('sub', v_seller)::text, false);
  perform public.seller_mark_delivered(v_order2, 'данные переданы');
  perform set_config('request.jwt.claims', json_build_object('sub', v_buyer)::text, false);
  select version into v_ver from public.orders where id = v_order2;
  v_res := public.buyer_confirm_order(v_order2, v_ver);
  select count(*) into v_cnt from public.transactions
   where order_id = v_order2 and type in ('FEE','PAYOUT');
  insert into public._escrow_test_log(name, result, detail)
  values ('19 happy path COMPLETED + FEE/PAYOUT',
          case when v_res->>'status' = 'COMPLETED' and v_cnt = 2 then 'PASS' else 'FAIL' end,
          'tx=' || v_cnt || ' ' || v_res::text);

  -- 20. Повторное подтверждение — идемпотентно, без второй выплаты ----------
  v_res := public.buyer_confirm_order(v_order2);
  select count(*) into v_cnt from public.transactions where order_id = v_order2 and type = 'PAYOUT';
  insert into public._escrow_test_log(name, result, detail)
  values ('20 confirm replay idempotent',
          case when (v_res->>'idempotent')::bool and v_cnt = 1 then 'PASS' else 'FAIL' end,
          'payouts=' || v_cnt);

  -- 21. Аудит переходов полон ------------------------------------------------
  select count(*) into v_cnt from public.order_events where order_id = v_order;
  insert into public._escrow_test_log(name, result, detail)
  values ('21 audit trail written', case when v_cnt >= 4 then 'PASS' else 'FAIL' end, 'events=' || v_cnt);

  -- cleanup ------------------------------------------------------------------
  perform set_config('request.jwt.claims', '', false);
  -- append-only защита снимается только на время очистки тестовых данных
  alter table public.order_events disable trigger trg_order_events_append_only;
  alter table public.transactions disable trigger trg_transactions_append_only;
  delete from public.order_events where order_id in (v_order, v_order2);
  delete from public.transactions  where order_id in (v_order, v_order2);
  alter table public.order_events enable trigger trg_order_events_append_only;
  alter table public.transactions enable trigger trg_transactions_append_only;
  delete from public.payment_webhooks where order_id in (v_order, v_order2);
  delete from public.sales_feed    where order_id in (v_order, v_order2);
  delete from public.orders        where id in (v_order, v_order2);
  delete from public.user_roles    where user_id = v_arb;
end$$;

select name, result, left(detail, 120) as detail from public._escrow_test_log order by n;
