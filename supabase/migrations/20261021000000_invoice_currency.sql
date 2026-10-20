-- Per-invoice currency (PKR or AUD) with a business default.
begin;
alter table public.invoices add column if not exists currency text not null default 'AUD'
  check (currency in ('AUD', 'PKR'));
alter table public.app_settings add column if not exists invoice_currency text not null default 'AUD'
  check (invoice_currency in ('AUD', 'PKR'));
update public.app_settings set invoice_currency = 'PKR' where id = 1;
commit;
