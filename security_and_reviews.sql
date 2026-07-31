-- ============================================================================
-- tenge.gg — БЕЗОПАСНОСТЬ + РЕАЛЬНЫЕ ДАННЫЕ
-- Запускать в Supabase → SQL Editor целиком, сверху вниз.
-- Проверено против текущей базы axtptzceicyhnmnopaaa (31.07.2026).
-- ============================================================================


-- ############################################################################
-- ЧАСТЬ 1. КРИТИЧНО: любой человек сейчас может изменить ЛЮБОЙ лот
-- Проверка показала: PATCH /rest/v1/listings с анонимным ключом -> 204 OK.
-- То есть цену лота 78 000 ₸ можно снаружи переписать на 1 ₸.
-- ############################################################################

alter table public.listings enable row level security;

-- сносим все старые разрешающие политики на listings
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='listings'
  loop execute format('drop policy %I on public.listings', p.policyname); end loop;
end $$;

-- забираем у анонима права на запись на уровне грантов (второй рубеж)
revoke insert, update, delete on public.listings from anon;
grant select on public.listings to anon;
grant select, insert, update, delete on public.listings to authenticated;

-- читать активные лоты может кто угодно
create policy listings_read_active on public.listings
  for select using (status = 'active' or seller_id = auth.uid());

-- создавать лот может только авторизованный, и только от своего имени
create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (seller_id = auth.uid());

-- менять и удалять — только свой лот
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = auth.uid());

-- seller_id больше не должен быть пустым у новых лотов
alter table public.listings
  alter column seller_id set default auth.uid();


-- ############################################################################
-- ЧАСТЬ 2. РОЛИ И АДМИНКА
-- Сейчас пароль арбитра лежит строкой в admin.html — его видно в исходнике
-- страницы (Ctrl+U) у любого посетителя. Пароль в JS ничего не защищает.
-- Правильно: роль в базе + проверка на стороне Postgres.
-- ############################################################################

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null default 'user' check (role in ('user','seller','admin')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

drop policy if exists roles_read_self on public.user_roles;
create policy roles_read_self on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ШАГ ВРУЧНУЮ: зарегистрируйся на сайте своей почтой, потом подставь её сюда:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'ТВОЙ_EMAIL@example.com'
-- on conflict (user_id) do update set role = 'admin';


-- ############################################################################
-- ЧАСТЬ 3. ПРОДАВЦЫ (чтобы на витрине был реальный ник, галочка и число сделок)
-- Главная страница читает эти поля: seller_name, seller_verified, seller_deals.
-- ############################################################################

alter table public.listings add column if not exists seller_name     text;
alter table public.listings add column if not exists seller_verified boolean not null default false;
alter table public.listings add column if not exists seller_deals    integer not null default 0;

create table if not exists public.sellers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  verified   boolean not null default false,
  deals      integer not null default 0,
  rating     numeric(3,2),
  city       text,
  created_at timestamptz not null default now()
);
alter table public.sellers enable row level security;
grant select on public.sellers to anon, authenticated;

drop policy if exists sellers_read on public.sellers;
create policy sellers_read on public.sellers for select using (true);

drop policy if exists sellers_write_own on public.sellers;
create policy sellers_write_own on public.sellers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- подставлять ник и статистику продавца в лот автоматически
create or replace function public.fill_seller_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select s.nickname, s.verified, s.deals
    into NEW.seller_name, NEW.seller_verified, NEW.seller_deals
  from public.sellers s where s.user_id = NEW.seller_id;
  NEW.seller_name := coalesce(NEW.seller_name, 'Продавец KZ');
  return NEW;
end $$;

drop trigger if exists trg_fill_seller on public.listings;
create trigger trg_fill_seller before insert or update of seller_id on public.listings
  for each row execute function public.fill_seller_fields();


-- ############################################################################
-- ЧАСТЬ 4. РЕАЛЬНЫЕ ОТЗЫВЫ
-- Главная страница читает public.reviews и, если он пуст, просто НЕ показывает
-- блок отзывов. Накрутить нельзя: отзыв можно оставить только по своей
-- завершённой сделке и только один раз.
-- ############################################################################

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid unique references public.orders(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  author_name  text not null,
  city         text,
  subject      text,                        -- «PUBG Mobile · 660 UC»
  rating       smallint not null check (rating between 1 and 5),
  text         text not null check (char_length(text) between 10 and 1500),
  had_dispute  boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.reviews enable row level security;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);

drop policy if exists reviews_insert_after_deal on public.reviews;
create policy reviews_insert_after_deal on public.reviews
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.buyer_id = auth.uid()
        and o.status = 'COMPLETED'
    )
  );

drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ############################################################################
-- ЧАСТЬ 5. ЖИВАЯ ЛЕНТА СДЕЛОК (только настоящие покупки)
-- Главная подписана на INSERT в orders через Realtime. Нужны 2 поля и публикация.
-- ############################################################################

alter table public.orders add column if not exists buyer_name    text;
alter table public.orders add column if not exists listing_title text;

create or replace function public.fill_order_title()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.listing_title is null and NEW.listing_id is not null then
    select title into NEW.listing_title from public.listings where id = NEW.listing_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_fill_order_title on public.orders;
create trigger trg_fill_order_title before insert on public.orders
  for each row execute function public.fill_order_title();

-- включить Realtime для orders (иначе лента молчит)
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
end $$;

-- ВАЖНО: в ленте видно имя покупателя и товар. Пиши в buyer_name только имя
-- («Айдос, Алматы»), НИКОГДА не пиши туда email, телефон или игровой ID.


-- ############################################################################
-- ЧАСТЬ 6. ПРОВЕРКА, ЧТО ДЫРЫ ЗАКРЫТЫ
-- ############################################################################

select tablename,
       rowsecurity as rls_включен,
       (select count(*) from pg_policies p
         where p.schemaname='public' and p.tablename=t.tablename) as политик
from pg_tables t
where schemaname='public'
  and tablename in ('listings','orders','reviews','early_leads','app_settings','user_roles','sellers')
order by tablename;
