-- Run this in the Supabase dashboard → SQL Editor → New query.
-- Safe to re-run: every statement is idempotent, so use this same file to
-- upgrade a database created by an earlier version.

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Untitled invoice',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Draft / final / sent tracking.
alter table public.invoices
  add column if not exists status text not null default 'draft';

alter table public.invoices
  add column if not exists sent_at timestamptz;

alter table public.invoices
  add column if not exists sent_to text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'invoices_status_check'
  ) then
    alter table public.invoices
      add constraint invoices_status_check
      check (status in ('draft', 'final', 'sent'));
  end if;
end
$$;

-- Without RLS the public anon key would let anyone read every invoice,
-- including the bank account / IFSC / PAN fields. Keep this on.
alter table public.invoices enable row level security;

drop policy if exists "own invoices" on public.invoices;
create policy "own invoices"
  on public.invoices
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists invoices_user_updated_idx
  on public.invoices (user_id, updated_at desc);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_touch_updated_at on public.invoices;
create trigger invoices_touch_updated_at
  before update on public.invoices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- clients --

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default '',
  address     text not null default '',
  email       text not null default '',
  phone       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Hourly rate, kept as text for consistency with the app's other numeric
-- inputs (they're all free-text and parsed on use).
alter table public.clients
  add column if not exists rate text not null default '';

alter table public.clients enable row level security;

drop policy if exists "own clients" on public.clients;
create policy "own clients"
  on public.clients
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists clients_user_name_idx
  on public.clients (user_id, name);

drop trigger if exists clients_touch_updated_at on public.clients;
create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- profile --
-- One row per user: the "from" block and payment details reused on every
-- invoice. user_id is the primary key, so upsert can't create duplicates.

create table if not exists public.profile (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null default '',
  address_line1  text not null default '',
  address_line2  text not null default '',
  phone          text not null default '',
  account_no     text not null default '',
  ifsc           text not null default '',
  pan            text not null default '',
  updated_at     timestamptz not null default now()
);

alter table public.profile enable row level security;

drop policy if exists "own profile" on public.profile;
create policy "own profile"
  on public.profile
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists profile_touch_updated_at on public.profile;
create trigger profile_touch_updated_at
  before update on public.profile
  for each row execute function public.touch_updated_at();
