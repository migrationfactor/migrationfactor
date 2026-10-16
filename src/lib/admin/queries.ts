import 'server-only';
import { cache } from 'react';
import { createUserClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/auth';
import { bookingStatuses, leadStatuses } from '@/lib/leads/validation';

export const PAGE_SIZE = 20;

export interface ContactLead {
  id: string; created_at: string; updated_at: string; name: string; email: string; phone: string | null;
  service: string | null; message: string; consent: boolean; source: string; status: string;
  admin_notes: string | null; notification_status: string; viewed_at: string | null;
}

export interface ToolLead {
  id: string; created_at: string; updated_at: string; tool_slug: string; tool_name: string; name: string;
  email: string; phone: string | null; message: string | null; answers: Record<string, string>;
  result_summary: string | null; consent: boolean; status: string; admin_notes: string | null; notification_status: string; viewed_at: string | null;
}

export interface Booking {
  id: string; reference: string; created_at: string; updated_at: string; name: string; email: string; phone: string;
  country: string; service: string; format: string; preferred_date: string; preferred_time: string; timezone: string;
  starts_at: string; duration_minutes: number; message: string; consent: boolean; status: string;
  admin_notes: string | null; notification_status: string; viewed_at: string | null;
}

export interface CommunicationLead {
  id: string; created_at: string; updated_at: string; last_message_at: string; channel: 'whatsapp' | 'email'; name: string;
  email: string | null; phone: string | null; topic: string | null; source: string; consent: boolean; status: string;
  admin_notes: string | null; notification_status: string; viewed_at: string | null;
}

export interface CommunicationMessage {
  id: string; kind: string; body: string; subject: string | null; received_at: string;
}

export interface ActivityDay {
  day: string; contact_count: number; booking_count: number; whatsapp_count: number; email_count: number; tool_count: number;
}

export interface ListFilters {
  q?: string;
  status?: string;
  tool?: string;
  when?: string;
  page?: number;
}

/** Removes characters with meaning in PostgREST filter syntax before an ilike search. */
function searchTerm(q?: string): string {
  return (q || '').replace(/[%_,()*\\:."']/g, ' ').trim().slice(0, 80);
}

function range(page = 1) {
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  return [from, from + PAGE_SIZE - 1] as const;
}

export async function listContactLeads(filters: ListFilters) {
  const supabase = await createUserClient();
  let query = supabase.from('contact_leads').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const term = searchTerm(filters.q);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,service.ilike.%${term}%`);
  if (filters.status && (leadStatuses as readonly string[]).includes(filters.status)) query = query.eq('status', filters.status);
  const [from, to] = range(filters.page);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error('Could not load contact leads.');
  return { rows: (data ?? []) as ContactLead[], count: count ?? 0 };
}

export async function listToolLeads(filters: ListFilters) {
  const supabase = await createUserClient();
  let query = supabase.from('tool_leads').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  const term = searchTerm(filters.q);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,tool_name.ilike.%${term}%`);
  if (filters.status && (leadStatuses as readonly string[]).includes(filters.status)) query = query.eq('status', filters.status);
  if (filters.tool && /^[a-z0-9-]{2,60}$/.test(filters.tool)) query = query.eq('tool_slug', filters.tool);
  const [from, to] = range(filters.page);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error('Could not load tool leads.');
  return { rows: (data ?? []) as ToolLead[], count: count ?? 0 };
}

export async function listBookings(filters: ListFilters) {
  const supabase = await createUserClient();
  const upcoming = filters.when !== 'past' && filters.when !== 'all';
  let query = supabase.from('bookings').select('*', { count: 'exact' });
  const now = new Date().toISOString();
  if (filters.when === 'past') query = query.lt('starts_at', now).order('starts_at', { ascending: false });
  else if (upcoming) query = query.gte('starts_at', now).order('starts_at', { ascending: true });
  else query = query.order('created_at', { ascending: false });
  const term = searchTerm(filters.q);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,reference.ilike.%${term}%,service.ilike.%${term}%`);
  if (filters.status && (bookingStatuses as readonly string[]).includes(filters.status)) query = query.eq('status', filters.status);
  const [from, to] = range(filters.page);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error('Could not load bookings.');
  return { rows: (data ?? []) as Booking[], count: count ?? 0 };
}

export async function listCommunicationLeads(channel: CommunicationLead['channel'], filters: ListFilters) {
  const supabase = await createUserClient();
  let query = supabase.from('communication_leads').select('*', { count: 'exact' }).eq('channel', channel).order('last_message_at', { ascending: false });
  const term = searchTerm(filters.q);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,topic.ilike.%${term}%`);
  if (filters.status && (leadStatuses as readonly string[]).includes(filters.status)) query = query.eq('status', filters.status);
  const [from, to] = range(filters.page);
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error('Could not load enquiries.');
  return { rows: (data ?? []) as CommunicationLead[], count: count ?? 0 };
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every website request or received message for one WhatsApp number or email address, newest first. */
export async function listCommunicationMessages(leadId: string) {
  if (!uuid.test(leadId)) return [];
  const supabase = await createUserClient();
  const { data, error } = await supabase.from('communication_messages').select('id, kind, body, subject, received_at')
    .eq('lead_id', leadId).order('received_at', { ascending: false }).limit(100);
  if (error) throw new Error('Could not load the enquiry history.');
  return (data ?? []) as CommunicationMessage[];
}

/** Daily lead counts per source, aggregated in the database (Perth dates). */
export async function leadActivity(days: 7 | 30 | 90) {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc('lead_activity', { p_days: days });
  if (error) throw new Error('Could not load lead activity.');
  return ((data ?? []) as ActivityDay[]).map(row => ({
    day: row.day, contact: Number(row.contact_count), booking: Number(row.booking_count),
    whatsapp: Number(row.whatsapp_count), email: Number(row.email_count), tool: Number(row.tool_count),
  }));
}

export async function getRecord<T>(table: 'contact_leads' | 'tool_leads' | 'bookings' | 'communication_leads', id: string): Promise<T | null> {
  if (!uuid.test(id)) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Could not load the record.');
  return data as T | null;
}

export type LeadSection = 'whatsapp' | 'email' | 'contact' | 'booking' | 'tool';
export type NewLeadCounts = Record<LeadSection, number>;
interface AdminCounts {
  unread: NewLeadCounts;
  totals: Record<'whatsappNew' | 'whatsappTotal' | 'emailNew' | 'emailTotal' | 'contactNew' | 'contactTotal' | 'toolNew' | 'toolTotal' | 'bookingsPending' | 'bookingsUpcoming', number>;
}

/** Every sidebar and dashboard count in one database call, shared by the layout and page of a request. */
const adminCounts = cache(async (): Promise<AdminCounts> => {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc('admin_counts');
  if (error || !data) throw new Error('Could not load admin counts.');
  return data as AdminCounts;
});

/** Unopened items per section, shown as dots in the sidebar. */
export async function newLeadCounts(): Promise<NewLeadCounts> {
  try { return (await adminCounts()).unread; } catch { return { whatsapp: 0, email: 0, contact: 0, booking: 0, tool: 0 }; }
}

/**
 * Marks a lead as opened so its sidebar dot clears. Status is left for the admin to change.
 * Runs alongside the record read; it only writes when the lead has not been opened before.
 */
export async function markViewed(table: 'contact_leads' | 'tool_leads' | 'bookings' | 'communication_leads', id: string) {
  if (!uuid.test(id)) return;
  const supabase = await createUserClient();
  const { error } = await supabase.from(table).update({ viewed_at: new Date().toISOString() }).eq('id', id).is('viewed_at', null);
  if (error) console.warn('Could not mark the record as viewed.');
}

export async function dashboardSummary() {
  const supabase = await createUserClient();
  const now = new Date().toISOString();
  const [{ totals }, recentContacts, recentTools, nextBookings, recentMessages] = await Promise.all([
    adminCounts(),
    supabase.from('contact_leads').select('id, created_at, name, service, status, viewed_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('tool_leads').select('id, created_at, name, tool_name, status, viewed_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('bookings').select('id, reference, name, preferred_date, preferred_time, timezone, status, viewed_at').in('status', ['pending', 'confirmed']).gte('starts_at', now).order('starts_at').limit(5),
    supabase.from('communication_leads').select('id, last_message_at, name, channel, phone, email, topic, status, viewed_at').order('last_message_at', { ascending: false }).limit(6),
  ]);
  return {
    totals,
    recentContacts: (recentContacts.data ?? []) as Pick<ContactLead, 'id' | 'created_at' | 'name' | 'service' | 'status' | 'viewed_at'>[],
    recentTools: (recentTools.data ?? []) as Pick<ToolLead, 'id' | 'created_at' | 'name' | 'tool_name' | 'status' | 'viewed_at'>[],
    recentMessages: (recentMessages.data ?? []) as Pick<CommunicationLead, 'id' | 'last_message_at' | 'name' | 'channel' | 'phone' | 'email' | 'topic' | 'status' | 'viewed_at'>[],
    nextBookings: (nextBookings.data ?? []) as Pick<Booking, 'id' | 'reference' | 'name' | 'preferred_date' | 'preferred_time' | 'timezone' | 'status' | 'viewed_at'>[],
  };
}

/** Records that this admin opened a section, which clears its sidebar badge (not the per-lead dots). */
export async function markSectionSeen(section: LeadSection) {
  const admin = await requireAdmin();
  const supabase = await createUserClient();
  const { error } = await supabase.from('admin_section_views')
    .upsert({ user_id: admin.userId, section, seen_at: new Date().toISOString() }, { onConflict: 'user_id,section' });
  if (error) console.warn('Could not record the section view.');
}
