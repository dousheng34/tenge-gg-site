-- Персистентный журнал событий безопасности.
--
-- Зачем отдельно от audit_log: audit_log описывает бизнес-события сделок (переходы escrow),
-- а здесь фиксируются попытки обхода — маскированные контакты, заблокированные реквизиты,
-- срабатывания лимитов. Разные права доступа, разный срок хранения, разная нагрузка.
--
-- ВАЖНО: приложение начнёт писать сюда только после применения миграции и регенерации типов:
--   npm run db:push && npm run db:types
-- До этого lib/security/audit.ts пишет события в stdout — см. docs/SECURITY.md.

create table if not exists public.security_events (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  event        text        not null,
  actor_id     uuid        references auth.users (id) on delete set null,
  entity       text,
  entity_id    text,
  -- Виды находок, но НЕ сами реквизиты: журнал не должен становиться утечкой.
  findings     jsonb       not null default '[]'::jsonb,
  ip           inet,
  user_agent   text,
  constraint security_events_event_not_blank check (length(btrim(event)) > 0)
);

comment on table public.security_events is
  'Попытки обхода платформы: маскированные контакты, заблокированные реквизиты, срабатывания лимитов.';
comment on column public.security_events.findings is
  'Массив {kind, severity}. Хранить сами номера карт/телефоны запрещено.';

create index if not exists security_events_created_at_idx on public.security_events (created_at desc);
create index if not exists security_events_actor_idx      on public.security_events (actor_id, created_at desc);
create index if not exists security_events_event_idx      on public.security_events (event, created_at desc);

alter table public.security_events enable row level security;

-- Читать журнал может только персонал. Писать напрямую не может никто:
-- вставка идёт исключительно через SECURITY DEFINER функцию ниже.
drop policy if exists security_events_staff_read on public.security_events;
create policy security_events_staff_read
  on public.security_events
  for select
  to authenticated
  using (public.is_staff());

revoke all on table public.security_events from anon, authenticated;
grant select on table public.security_events to authenticated;

-- Запись события. actor берётся из auth.uid(), а не из аргумента: подделать нельзя.
create or replace function public.log_security_event(
  p_event    text,
  p_entity   text default null,
  p_entity_id text default null,
  p_findings jsonb default '[]'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if jsonb_typeof(p_findings) <> 'array' then
    raise exception 'findings must be a json array' using errcode = '22023';
  end if;

  insert into public.security_events (event, actor_id, entity, entity_id, findings)
  values (left(p_event, 64), auth.uid(), left(p_entity, 64), left(p_entity_id, 64), p_findings);
end;
$$;

revoke all on function public.log_security_event(text, text, text, jsonb) from public, anon;
grant execute on function public.log_security_event(text, text, text, jsonb) to authenticated;

comment on function public.log_security_event is
  'Единственный путь записи в security_events. Actor берётся из auth.uid().';
