-- Additive: sidebar badges clear when an admin opens a section, like a notification count.
-- Per-lead "unread" (viewed_at) is unchanged and still clears only when the lead itself is opened.
begin;

create table if not exists public.admin_section_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('whatsapp', 'email', 'contact', 'booking', 'tool')),
  seen_at timestamptz not null default now(),
  primary key (user_id, section)
);
alter table public.admin_section_views enable row level security;
revoke all on public.admin_section_views from anon, authenticated;
grant select, insert, update on public.admin_section_views to authenticated;
drop policy if exists "admins manage own section views" on public.admin_section_views;
create policy "admins manage own section views" on public.admin_section_views for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_admin()))
  with check (user_id = (select auth.uid()) and (select public.is_admin()));

-- Badge = unopened leads that arrived after this admin last opened the section.
create or replace function public.admin_counts()
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
 seen jsonb;
 since_whatsapp timestamptz; since_email timestamptz; since_contact timestamptz; since_booking timestamptz; since_tool timestamptz;
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select coalesce(jsonb_object_agg(v.section, v.seen_at), '{}'::jsonb) into seen
   from public.admin_section_views v where v.user_id = (select auth.uid());
 since_whatsapp := coalesce((seen->>'whatsapp')::timestamptz, '-infinity');
 since_email := coalesce((seen->>'email')::timestamptz, '-infinity');
 since_contact := coalesce((seen->>'contact')::timestamptz, '-infinity');
 since_booking := coalesce((seen->>'booking')::timestamptz, '-infinity');
 since_tool := coalesce((seen->>'tool')::timestamptz, '-infinity');
 return jsonb_build_object(
  'unread', jsonb_build_object(
   'whatsapp', (select count(*) from public.communication_leads where channel='whatsapp' and viewed_at is null and last_message_at > since_whatsapp),
   'email', (select count(*) from public.communication_leads where channel='email' and viewed_at is null and last_message_at > since_email),
   'contact', (select count(*) from public.contact_leads where viewed_at is null and created_at > since_contact),
   'booking', (select count(*) from public.bookings where viewed_at is null and created_at > since_booking),
   'tool', (select count(*) from public.tool_leads where viewed_at is null and created_at > since_tool)),
  'totals', jsonb_build_object(
   'whatsappNew', (select count(*) from public.communication_leads where channel='whatsapp' and status='new'),
   'whatsappTotal', (select count(*) from public.communication_leads where channel='whatsapp'),
   'emailNew', (select count(*) from public.communication_leads where channel='email' and status='new'),
   'emailTotal', (select count(*) from public.communication_leads where channel='email'),
   'contactNew', (select count(*) from public.contact_leads where status='new'),
   'contactTotal', (select count(*) from public.contact_leads),
   'toolNew', (select count(*) from public.tool_leads where status='new'),
   'toolTotal', (select count(*) from public.tool_leads),
   'bookingsPending', (select count(*) from public.bookings where status='pending'),
   'bookingsUpcoming', (select count(*) from public.bookings where status in ('pending','confirmed') and starts_at >= now())));
end $$;
revoke all on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;

commit;
