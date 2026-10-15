-- Additive: "seen" markers for the admin sidebar dots, and one aggregate for all admin counts.
begin;

-- A lead is unread until an admin opens it. Status stays a separate, deliberate workflow field.
alter table public.contact_leads add column if not exists viewed_at timestamptz;
alter table public.tool_leads add column if not exists viewed_at timestamptz;
alter table public.bookings add column if not exists viewed_at timestamptz;
alter table public.communication_leads add column if not exists viewed_at timestamptz;

-- Everything already handled before this migration counts as seen.
update public.contact_leads set viewed_at = updated_at where viewed_at is null and status <> 'new';
update public.tool_leads set viewed_at = updated_at where viewed_at is null and status <> 'new';
update public.bookings set viewed_at = updated_at where viewed_at is null and status <> 'pending';
update public.communication_leads set viewed_at = updated_at where viewed_at is null and status <> 'new';

grant update (viewed_at) on public.contact_leads, public.tool_leads, public.bookings, public.communication_leads to authenticated;

create index if not exists contact_leads_unread_idx on public.contact_leads (created_at) where viewed_at is null;
create index if not exists tool_leads_unread_idx on public.tool_leads (created_at) where viewed_at is null;
create index if not exists bookings_unread_idx on public.bookings (created_at) where viewed_at is null;
create index if not exists communication_leads_unread_idx on public.communication_leads (channel) where viewed_at is null;

-- Opening a lead must not change its "last updated" time.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'viewed_at' - 'updated_at') = (to_jsonb(old) - 'viewed_at' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- Same as before, plus: a new (non-duplicate) enquiry from a known number/address marks the lead unread again.
create or replace function public.save_communication(
 p_channel text,p_identity text,p_name text,p_email text,p_phone text,p_topic text,p_source text,
 p_body text,p_subject text,p_event_key text,p_kind text,p_consent boolean,p_received_at timestamptz
) returns table(lead_id uuid,is_duplicate boolean,is_new boolean)
language plpgsql security invoker set search_path='' as $$
declare found_id uuid; existing_id uuid; new_lead boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_channel||':'||p_identity,0));
 select m.lead_id into found_id from public.communication_messages m where m.event_key=p_event_key;
 if found_id is not null then return query select found_id,true,false; return; end if;
 select l.id into existing_id from public.communication_leads l where l.channel=p_channel and l.identity_key=p_identity;
 new_lead := existing_id is null;
 insert into public.communication_leads(channel,identity_key,name,email,phone,topic,source,consent,last_message_at)
 values(p_channel,p_identity,p_name,p_email,p_phone,p_topic,p_source,p_consent,p_received_at)
 on conflict(channel,identity_key) do update set
  name=excluded.name,
  email=coalesce(excluded.email,communication_leads.email),
  phone=coalesce(excluded.phone,communication_leads.phone),
  topic=coalesce(excluded.topic,communication_leads.topic),
  consent=communication_leads.consent or excluded.consent,
  last_message_at=greatest(communication_leads.last_message_at,excluded.last_message_at),
  viewed_at=null
 returning id into found_id;
 insert into public.communication_messages(lead_id,event_key,kind,body,subject,received_at)
 values(found_id,p_event_key,p_kind,p_body,p_subject,p_received_at);
 return query select found_id,false,new_lead;
end $$;
revoke all on function public.save_communication(text,text,text,text,text,text,text,text,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.save_communication(text,text,text,text,text,text,text,text,text,text,text,boolean,timestamptz) to service_role;

-- Every admin count in one round trip (sidebar dots and dashboard cards).
create or replace function public.admin_counts()
returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 return jsonb_build_object(
  'unread', jsonb_build_object(
   'whatsapp', (select count(*) from public.communication_leads where channel='whatsapp' and viewed_at is null),
   'email', (select count(*) from public.communication_leads where channel='email' and viewed_at is null),
   'contact', (select count(*) from public.contact_leads where viewed_at is null),
   'booking', (select count(*) from public.bookings where viewed_at is null),
   'tool', (select count(*) from public.tool_leads where viewed_at is null)),
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
