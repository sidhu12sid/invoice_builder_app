-- Run after schema.sql in the Supabase SQL Editor, as the database owner.
-- Password hashes, OTP hashes and OTP expiry belong to Supabase auth.users.
-- Never copy passwords or verification codes into this public table.
begin;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default false
);
alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
drop policy if exists "read own account" on public.users;
create policy "read own account" on public.users for select to authenticated
  using (id = (select auth.uid()));

create or replace function public.sync_auth_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.users(id, first_name, last_name, created_at, is_active)
    values(new.id, left(coalesce(new.raw_user_meta_data->>'first_name', ''),100),
      left(coalesce(new.raw_user_meta_data->>'last_name', ''),100), new.created_at,
      new.email_confirmed_at is not null)
    on conflict (id) do nothing;
  elsif old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.users set is_active = true, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_account() from public, anon, authenticated;
drop trigger if exists sync_invoice_account on auth.users;
create trigger sync_invoice_account after insert or update of email_confirmed_at
  on auth.users for each row execute function public.sync_auth_account();

insert into public.users(id, first_name, last_name, created_at, is_active)
select id, left(coalesce(raw_user_meta_data->>'first_name',''),100),
  left(coalesce(raw_user_meta_data->>'last_name',''),100), created_at,
  email_confirmed_at is not null
from auth.users on conflict(id) do nothing;

drop trigger if exists users_touch_updated_at on public.users;
create trigger users_touch_updated_at before update on public.users
  for each row execute function public.touch_updated_at();

-- These restrictive policies supplement the existing ownership policies.
-- Deactivated accounts cannot bypass the application via the public API.
drop policy if exists "active account required" on public.invoices;
create policy "active account required" on public.invoices as restrictive
  for all to authenticated
  using (exists(select 1 from public.users where id = (select auth.uid()) and is_active))
  with check (exists(select 1 from public.users where id = (select auth.uid()) and is_active));
drop policy if exists "active account required" on public.clients;
create policy "active account required" on public.clients as restrictive
  for all to authenticated
  using (exists(select 1 from public.users where id = (select auth.uid()) and is_active))
  with check (exists(select 1 from public.users where id = (select auth.uid()) and is_active));
drop policy if exists "active account required" on public.profile;
create policy "active account required" on public.profile as restrictive
  for all to authenticated
  using (exists(select 1 from public.users where id = (select auth.uid()) and is_active))
  with check (exists(select 1 from public.users where id = (select auth.uid()) and is_active));
commit;
