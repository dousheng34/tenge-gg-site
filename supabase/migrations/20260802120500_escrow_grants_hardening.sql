-- ============================================================================
-- tenge.gg — Escrow :: 06 GRANTS HARDENING
--
-- Supabase выдаёт EXECUTE на все новые функции схемы public ролям
-- anon/authenticated через ALTER DEFAULT PRIVILEGES. `revoke ... from public`
-- эти гранты НЕ снимает. Без явного revoke ядро стейт-машины и приём
-- вебхука Kaspi вызывались бы анонимно через /rest/v1/rpc/*.
--
-- Правило: наружу торчат только пользовательские RPC (authenticated),
-- вебхук и cron — только service_role, остальное — никому.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Ядро стейт-машины и денежные примитивы — недоступны из REST
-- ---------------------------------------------------------------------------

revoke all on function public.escrow_apply_transition(uuid, public.order_status, public.escrow_actor, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.escrow_post_transaction(uuid, public.escrow_tx_type, bigint, text, uuid, public.escrow_actor, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.escrow_settle(public.orders, public.order_status, uuid, public.escrow_actor) from public, anon, authenticated;
revoke all on function public.escrow_actor_for(public.orders) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Триггерные функции (runtime-проверка привилегий не выполняется —
--    достаточно прав у создателя триггера)
-- ---------------------------------------------------------------------------

revoke all on function public.enforce_order_transition()  from public, anon, authenticated;
revoke all on function public.normalize_order_insert()    from public, anon, authenticated;
revoke all on function public.audit_order_insert()        from public, anon, authenticated;
revoke all on function public.tg_settle_on_terminal()     from public, anon, authenticated;
revoke all on function public.tg_append_only()            from public, anon, authenticated;
revoke all on function public.notify_order_event()        from public, anon, authenticated;
revoke all on function public.notify_seller_sold()        from public, anon, authenticated;
revoke all on function public.bump_seller_stats()         from public, anon, authenticated;
revoke all on function public.fill_order_from_listing()   from public, anon, authenticated;
revoke all on function public.push_sales_feed()           from public, anon, authenticated;
revoke all on function public.tg_send(text)               from public, anon, authenticated;

do $$
declare r record;
begin
  -- Прочие легаси-триггеры MVP (fill_seller_fields, recalc_seller_rating, ...)
  for r in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- 3. Вебхук Kaspi и SLA-джоба — только доверенный бэкенд
-- ---------------------------------------------------------------------------

revoke all on function public.kaspi_webhook_capture(text, text, uuid, text, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.kaspi_webhook_capture(text, text, uuid, text, bigint, jsonb, text) to service_role;

revoke all on function public.escrow_run_slas() from public, anon, authenticated;
grant execute on function public.escrow_run_slas() to service_role;

-- ---------------------------------------------------------------------------
-- 4. Пользовательские RPC — authenticated, но не anon
-- ---------------------------------------------------------------------------

revoke all on function public.buyer_confirm_order(uuid, integer)                    from public, anon;
revoke all on function public.seller_mark_delivered(uuid, text, integer)            from public, anon;
revoke all on function public.open_dispute(uuid, text, integer)                     from public, anon;
revoke all on function public.arbiter_resolve_dispute(uuid, text, text, integer)    from public, anon;
revoke all on function public.escrow_create_order(uuid, text)                       from public, anon;
revoke all on function public.escrow_attach_payment_intent(uuid, text, timestamptz) from public, anon;
revoke all on function public.admin_confirm_manual_payment(uuid, text, text)        from public, anon;

grant execute on function public.buyer_confirm_order(uuid, integer)                    to authenticated, service_role;
grant execute on function public.seller_mark_delivered(uuid, text, integer)            to authenticated, service_role;
grant execute on function public.open_dispute(uuid, text, integer)                     to authenticated, service_role;
grant execute on function public.arbiter_resolve_dispute(uuid, text, text, integer)    to authenticated, service_role;
grant execute on function public.escrow_create_order(uuid, text)                       to authenticated, service_role;
grant execute on function public.escrow_attach_payment_intent(uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.admin_confirm_manual_payment(uuid, text, text)        to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Функции, вызываемые ВНУТРИ RLS-политик, обязаны быть исполняемы
--    вызывающей ролью — оставляем гранты осознанно.
-- ---------------------------------------------------------------------------

grant execute on function public.is_admin()   to authenticated;
grant execute on function public.is_arbiter() to authenticated;
grant execute on function public.is_staff()   to authenticated, anon;
grant execute on function public.escrow_is_terminal(public.order_status) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Фиксация search_path у оставшихся функций (advisor 0011)
-- ---------------------------------------------------------------------------

alter function public.escrow_transition_allowed(public.order_status, public.order_status, public.escrow_actor)
  set search_path = public, pg_temp;
alter function public.escrow_is_terminal(public.order_status) set search_path = public, pg_temp;
alter function public.tg_append_only() set search_path = public, pg_temp;

commit;
