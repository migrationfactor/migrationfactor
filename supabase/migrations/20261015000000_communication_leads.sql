-- Additive migration: preserve existing contact leads, tools, bookings and admin accounts.
begin;
create table if not exists public.communication_leads (
 id uuid primary key default gen_random_uuid(),
 channel text not null check(channel in ('whatsapp','email')),
 identity_key text not null check(char_length(identity_key) between 1 and 200),
 name text not null check(char_length(name) between 2 and 100),
 email text check(email is null or char_length(email) between 3 and 254),
 phone text check(phone is null or char_length(phone) between 6 and 40),
 topic text check(topic is null or char_length(topic)<=120),
 source text not null check(source in ('whatsapp_form','email_form','whatsapp_inbound','email_inbound')),
 consent boolean not null default false,
 status text not null default 'new' check(status in ('new','contacted','qualified','closed','spam')),
 admin_notes text check(admin_notes is null or char_length(admin_notes)<=4000),
 notification_status text not null default 'pending' check(notification_status in ('pending','sent','failed','skipped')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_message_at timestamptz not null default now(),
 unique(channel,identity_key)
);
create table if not exists public.communication_messages (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.communication_leads(id) on delete cascade,
 event_key text not null unique check(char_length(event_key) between 1 and 512),
 kind text not null check(kind in ('website_request','received_message')),
 body text not null check(char_length(body) between 1 and 10000),
 subject text check(subject is null or char_length(subject)<=200),
 received_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create index if not exists communication_leads_created_idx on public.communication_leads(created_at desc);
create index if not exists communication_leads_status_idx on public.communication_leads(status,channel);
create index if not exists communication_messages_lead_idx on public.communication_messages(lead_id,received_at desc);
drop trigger if exists communication_leads_touch on public.communication_leads;
create trigger communication_leads_touch before update on public.communication_leads for each row execute function public.touch_updated_at();
alter table public.communication_leads enable row level security;
alter table public.communication_messages enable row level security;
revoke all on public.communication_leads,public.communication_messages from anon,authenticated;
grant select on public.communication_leads,public.communication_messages to authenticated;
grant update(status,admin_notes) on public.communication_leads to authenticated;
grant all on public.communication_leads,public.communication_messages to service_role;
drop policy if exists "admins read communication leads" on public.communication_leads;
create policy "admins read communication leads" on public.communication_leads for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update communication leads" on public.communication_leads;
create policy "admins update communication leads" on public.communication_leads for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "admins read communication messages" on public.communication_messages;
create policy "admins read communication messages" on public.communication_messages for select to authenticated using ((select public.is_admin()));

-- One transaction saves a lead and its event. Replayed events never duplicate messages.
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
  last_message_at=greatest(communication_leads.last_message_at,excluded.last_message_at)
 returning id into found_id;
 insert into public.communication_messages(lead_id,event_key,kind,body,subject,received_at)
 values(found_id,p_event_key,p_kind,p_body,p_subject,p_received_at);
 return query select found_id,false,new_lead;
end $$;
revoke all on function public.save_communication(text,text,text,text,text,text,text,text,text,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.save_communication(text,text,text,text,text,text,text,text,text,text,text,boolean,timestamptz) to service_role;

-- Aggregate in the database; never truncate charts at the Data API's row limit.
create or replace function public.lead_activity(p_days integer default 30)
returns table(day date,contact_count bigint,booking_count bigint,whatsapp_count bigint,email_count bigint,tool_count bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_days not in (7,30,90) then raise exception 'Unsupported period'; end if;
 return query
 with dates as (
  select ((now() at time zone 'Australia/Perth')::date - n)::date d from generate_series(0,p_days-1) n
 ), events as (
  select (created_at at time zone 'Australia/Perth')::date d,'contact'::text kind from public.contact_leads
  union all select (created_at at time zone 'Australia/Perth')::date,'booking' from public.bookings
  union all select (created_at at time zone 'Australia/Perth')::date,channel from public.communication_leads
  union all select (created_at at time zone 'Australia/Perth')::date,'tool' from public.tool_leads
 )
 select dates.d,count(*) filter(where events.kind='contact'),count(*) filter(where events.kind='booking'),
 count(*) filter(where events.kind='whatsapp'),count(*) filter(where events.kind='email'),count(*) filter(where events.kind='tool')
 from dates left join events on dates.d=events.d group by dates.d order by dates.d;
end $$;
revoke all on function public.lead_activity(integer) from public,anon;
grant execute on function public.lead_activity(integer) to authenticated;
commit;
