-- Run after schema.sql and auth-migration.sql in the Supabase SQL Editor.
begin;
create table if not exists public.currencies (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{3}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  symbol text not null check (length(trim(symbol)) between 1 and 12),
  created_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.currencies enable row level security;
revoke all on public.currencies from anon, authenticated;
grant select, insert on public.currencies to authenticated;
drop policy if exists "own currencies" on public.currencies;
create policy "own currencies" on public.currencies for all to authenticated
  using (user_id = (select auth.uid()) and exists(select 1 from public.users where id = (select auth.uid()) and is_active))
  with check (user_id = (select auth.uid()) and exists(select 1 from public.users where id = (select auth.uid()) and is_active));

alter table public.clients add column if not exists currency text not null default '₹';
alter table public.clients add column if not exists currency_code text not null default 'INR';

insert into public.currencies(user_id,code,name,symbol)
select id,'INR','Indian rupee','₹' from auth.users on conflict do nothing;

create or replace function public.seed_user_currency()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.currencies(user_id,code,name,symbol)
  values(new.id,'INR','Indian rupee','₹') on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.seed_user_currency() from public, anon, authenticated;
drop trigger if exists seed_invoice_currency on auth.users;
create trigger seed_invoice_currency after insert on auth.users
  for each row execute function public.seed_user_currency();
commit;
