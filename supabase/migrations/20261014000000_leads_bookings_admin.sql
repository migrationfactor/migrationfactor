-- Migration Factor: contact leads, tool leads, consultation bookings and admin access.
-- Idempotent: safe to re-run. Public visitors never access these tables directly;
-- the website writes through server-only API routes using the secret key, and
-- admins read/update through RLS policies gated by public.is_admin().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin membership
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Website contact form leads
-- ---------------------------------------------------------------------------
create table if not exists public.contact_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  service text check (service is null or char_length(service) <= 120),
  message text not null check (char_length(message) between 10 and 3000),
  consent boolean not null default false,
  source text not null default 'contact_form' check (source in ('contact_form')),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  dedupe_key text
);

create index if not exists contact_leads_created_idx on public.contact_leads (created_at desc);
create index if not exists contact_leads_status_idx on public.contact_leads (status);
create unique index if not exists contact_leads_dedupe_idx on public.contact_leads (dedupe_key) where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Migration / visa tool leads
-- ---------------------------------------------------------------------------
create table if not exists public.tool_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tool_slug text not null check (char_length(tool_slug) between 2 and 60),
  tool_name text not null check (char_length(tool_name) between 2 and 120),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) <= 40),
  message text check (message is null or char_length(message) <= 3000),
  answers jsonb not null default '{}'::jsonb,
  result_summary text check (result_summary is null or char_length(result_summary) <= 6000),
  consent boolean not null default false,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  dedupe_key text
);

create index if not exists tool_leads_created_idx on public.tool_leads (created_at desc);
create index if not exists tool_leads_tool_idx on public.tool_leads (tool_slug);
create index if not exists tool_leads_status_idx on public.tool_leads (status);
create unique index if not exists tool_leads_dedupe_idx on public.tool_leads (dedupe_key) where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Consultation bookings (requests; a consultant confirms the time)
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (char_length(phone) between 6 and 40),
  country text not null check (char_length(country) between 2 and 80),
  service text not null check (char_length(service) between 2 and 120),
  format text not null check (format in ('phone', 'video')),
  preferred_date date not null,
  preferred_time time not null,
  timezone text not null default 'Asia/Karachi',
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 120),
  message text not null check (char_length(message) between 10 and 1500),
  consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  idempotency_key uuid unique
);

create index if not exists bookings_created_idx on public.bookings (created_at desc);
create index if not exists bookings_starts_idx on public.bookings (starts_at);
create index if not exists bookings_status_idx on public.bookings (status);
-- One active request per person per time; cancelled requests free the slot again.
create unique index if not exists bookings_person_slot_idx
  on public.bookings (lower(email), starts_at) where status <> 'cancelled';
-- A time can only be confirmed for one client.
create unique index if not exists bookings_confirmed_slot_idx
  on public.bookings (starts_at) where status = 'confirmed';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists contact_leads_touch on public.contact_leads;
create trigger contact_leads_touch before update on public.contact_leads
  for each row execute function public.touch_updated_at();
drop trigger if exists tool_leads_touch on public.tool_leads;
create trigger tool_leads_touch before update on public.tool_leads
  for each row execute function public.touch_updated_at();
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: no anonymous access; admins read and update only.
-- ---------------------------------------------------------------------------
alter table public.admin_users enable row level security;
alter table public.contact_leads enable row level security;
alter table public.tool_leads enable row level security;
alter table public.bookings enable row level security;

revoke all on public.admin_users, public.contact_leads, public.tool_leads, public.bookings from anon;
revoke all on public.admin_users, public.contact_leads, public.tool_leads, public.bookings from authenticated;
grant select on public.admin_users to authenticated;
grant select on public.contact_leads, public.tool_leads, public.bookings to authenticated;
-- Admins may only change workflow fields; submitted visitor data stays as received.
grant update (status, admin_notes) on public.contact_leads, public.tool_leads, public.bookings to authenticated;

drop policy if exists "admins read own membership" on public.admin_users;
create policy "admins read own membership" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "admins read contact leads" on public.contact_leads;
create policy "admins read contact leads" on public.contact_leads
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update contact leads" on public.contact_leads;
create policy "admins update contact leads" on public.contact_leads
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins read tool leads" on public.tool_leads;
create policy "admins read tool leads" on public.tool_leads
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update tool leads" on public.tool_leads;
create policy "admins update tool leads" on public.tool_leads
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins read bookings" on public.bookings;
create policy "admins read bookings" on public.bookings
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update bookings" on public.bookings;
create policy "admins update bookings" on public.bookings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
