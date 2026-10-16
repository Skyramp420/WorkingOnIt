-- WorkingOnIt: your own database.
-- Paste all of this into Supabase → SQL Editor and click Run. Running it more than once is safe.

-- 1) one table for jobs, time, ideas…
create table if not exists public.woi_items (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  server_at timestamptz not null default clock_timestamp(),
  device text,
  primary key (owner, kind, id)
);
create index if not exists woi_items_sync on public.woi_items (owner, server_at);

-- 2) everyone sees only their own data
alter table public.woi_items enable row level security;
drop policy if exists "woi_vlastne" on public.woi_items;
create policy "woi_vlastne" on public.woi_items for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
grant select, insert, update, delete on public.woi_items to authenticated;

-- 3) server-side change time (devices use it to fetch what's new)
create or replace function public.woi_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.server_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists woi_touch on public.woi_items;
create trigger woi_touch before insert or update on public.woi_items
  for each row execute function public.woi_touch();

-- 4) images from notes and storyboards (private, each user only in their own folder)
insert into storage.buckets (id, name, public) values ('woi', 'woi', false) on conflict (id) do nothing;
drop policy if exists "woi_obr_citat" on storage.objects;
drop policy if exists "woi_obr_pridat" on storage.objects;
drop policy if exists "woi_obr_zmenit" on storage.objects;
drop policy if exists "woi_obr_zmazat" on storage.objects;
create policy "woi_obr_citat" on storage.objects for select to authenticated
  using (bucket_id = 'woi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "woi_obr_pridat" on storage.objects for insert to authenticated
  with check (bucket_id = 'woi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "woi_obr_zmenit" on storage.objects for update to authenticated
  using (bucket_id = 'woi' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "woi_obr_zmazat" on storage.objects for delete to authenticated
  using (bucket_id = 'woi' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 5) the database has one owner (you) and the account doesn't need email confirmation
create or replace function public.woi_owner_only() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Táto databáza už má majiteľa. / This database already has an owner.';
  end if;
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end $$;
drop trigger if exists woi_owner_only on auth.users;
create trigger woi_owner_only before insert on auth.users
  for each row execute function public.woi_owner_only();

select 'WorkingOnIt is ready ✓' as done;
