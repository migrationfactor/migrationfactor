-- E-signature: documents, templates, per-signer requests, audit log and private storage buckets.
-- Admins manage everything through RLS. Signers never query tables directly: the public signing
-- page validates its token on the server and uses the secret key there.
begin;

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  file_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.document_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  -- The original upload in the "documents" bucket; never overwritten.
  file_path text not null,
  -- The latest signed version in the "signed" bucket; every signature accumulates here.
  signed_file_path text,
  file_size integer,
  mime_type text not null default 'application/pdf',
  page_count integer,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  email_subject text check (email_subject is null or char_length(email_subject) <= 200),
  email_message text check (email_message is null or char_length(email_message) <= 2000),
  self_sign boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_created_idx on public.documents (created_at desc);

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  signer_name text not null check (char_length(signer_name) between 1 and 160),
  signer_email text not null check (char_length(signer_email) between 3 and 254),
  role text not null default 'signer' check (role in ('signer', 'cc')),
  token text not null unique check (token ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed', 'declined', 'expired')),
  fields jsonb not null default '[]'::jsonb,
  signing_order integer not null default 1 check (signing_order between 1 and 50),
  signing_message text check (signing_message is null or char_length(signing_message) <= 1000),
  reminder_interval_days integer check (reminder_interval_days is null or reminder_interval_days between 1 and 60),
  last_reminded_at timestamptz,
  signature_url text,
  ip_address text,
  user_agent text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists signature_requests_document_idx on public.signature_requests (document_id);
create index if not exists signature_requests_status_idx on public.signature_requests (status);
create index if not exists signature_requests_created_idx on public.signature_requests (created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
drop trigger if exists document_templates_touch on public.document_templates;
create trigger document_templates_touch before update on public.document_templates for each row execute function public.touch_updated_at();
drop trigger if exists signature_requests_touch on public.signature_requests;
create trigger signature_requests_touch before update on public.signature_requests for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['document_templates', 'documents', 'signature_requests', 'audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "admins manage %s" on public.%I', t, t);
    execute format('create policy "admins manage %s" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
  end loop;
end $$;
-- The audit trail is append-only for admins.
revoke update, delete on public.audit_logs from authenticated;

-- Private buckets. No storage policies are added, so only the server (secret key) can read or
-- write objects; browsers get short-lived signed URLs created after an admin or token check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('documents', 'documents', false, 20971520, array['application/pdf']),
  ('templates', 'templates', false, 20971520, array['application/pdf']),
  ('signatures', 'signatures', false, 2097152, array['image/png']),
  ('signed', 'signed', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
