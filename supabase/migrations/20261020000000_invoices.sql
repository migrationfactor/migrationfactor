-- Invoicing: settings, item catalog, invoices, line items and payments. Admin-only through RLS.
begin;

-- ---------------------------------------------------------------------------
-- Business settings (singleton row id = 1). Invoices, PDFs and emails read from here.
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Migration Factor',
  tagline text,
  registration_number text,
  office_address text,
  contact_phone text,
  contact_email text,
  website_url text,
  logo_url text,
  invoice_prefix text not null default 'INV-' check (char_length(invoice_prefix) <= 12),
  invoice_default_terms text not null default 'Due on Receipt',
  invoice_due_days integer not null default 0 check (invoice_due_days between 0 and 365),
  invoice_notes text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, business_name, tagline, office_address, contact_phone, contact_email, website_url, invoice_notes)
values (1, 'Migration Factor', 'Migration & Visa Consultancy', 'Mirrabooka, Perth, WA 6064', '+61 0450 635 162',
        'info@migrationfactor.com', 'https://migrationfactor.com',
        'Bank Details: Name: [account name] | BSB: [BSB] | ACC No.: [account number]')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Numbering
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');
exception when duplicate_object then null; end $$;

create sequence if not exists public.invoice_number_seq start 1;

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return lpad(nextval('public.invoice_number_seq')::text, 6, '0');
end;
$$;
revoke all on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  default_rate numeric(12,2) not null default 0 check (default_rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  bill_to_name text not null check (char_length(bill_to_name) between 1 and 160),
  bill_to_email text not null check (char_length(bill_to_email) between 3 and 254),
  bill_to_phone text check (bill_to_phone is null or char_length(bill_to_phone) <= 40),
  bill_to_address text check (bill_to_address is null or char_length(bill_to_address) <= 1000),
  booking_id uuid references public.bookings (id) on delete set null,
  status public.invoice_status not null default 'draft',
  invoice_date date not null default current_date,
  due_date date not null default current_date,
  terms text not null default 'Due on Receipt',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  notes text check (notes is null or char_length(notes) <= 4000),
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_booking_idx on public.invoices (booking_id);
create index if not exists invoices_status_idx on public.invoices (status);
create index if not exists invoices_email_idx on public.invoices (bill_to_email);
create index if not exists invoices_created_idx on public.invoices (created_at desc);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  item_name text not null check (char_length(item_name) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  quantity numeric(12,2) not null default 1 check (quantity >= 0),
  rate numeric(12,2) not null default 0 check (rate >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id);

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  mode text not null default 'Cash' check (char_length(mode) <= 40),
  reference_number text check (reference_number is null or char_length(reference_number) <= 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: admins only, nothing for anonymous visitors.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['app_settings', 'invoice_catalog_items', 'invoices', 'invoice_line_items', 'invoice_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "admins manage %s" on public.%I', t, t);
    execute format('create policy "admins manage %s" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
  end loop;
end $$;
revoke delete, insert on public.app_settings from authenticated;
revoke all on sequence public.invoice_number_seq from anon, authenticated;

-- Starter catalog: service names only. Prices stay at 0 until the business sets them in Settings.
insert into public.invoice_catalog_items (name, description, default_rate)
select v.name, v.description, 0
from (values
  ('Initial Consultation (30 minutes)', 'Migration consultation'),
  ('Professional Service Fee', 'Visa application preparation and lodgement'),
  ('Student Visa (Subclass 500)', 'Application preparation and lodgement'),
  ('Visitor Visa (Subclass 600)', 'Application preparation and lodgement'),
  ('Partner Visa', 'Application preparation and lodgement'),
  ('Skilled Visa (189 / 190 / 491)', 'Application preparation and lodgement'),
  ('Parent Visa', 'Application preparation and lodgement'),
  ('Visa Refusal Review / Appeal', 'Tribunal or review application support')
) as v(name, description)
where not exists (select 1 from public.invoice_catalog_items);

commit;
