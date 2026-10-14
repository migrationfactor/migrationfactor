import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import { bookingStatuses, leadStatuses } from '@/lib/leads/validation';

export const PAGE_SIZE = 20;

export interface ContactLead {
  id: string; created_at: string; updated_at: string; name: string; email: string; phone: string | null;
  service: string | null; message: string; consent: boolean; source: string; status: string;
  admin_notes: string | null; notification_status: string;
}

export interface ToolLead {
  id: string; created_at: string; updated_at: string; tool_slug: string; tool_name: string; name: string;
  email: string; phone: string | null; message: string | null; answers: Record<string, string>;
  result_summary: string | null; consent: boolean; status: string; admin_notes: string | null; notification_status: string;
}

export interface Booking {
  id: string; reference: string; created_at: string; updated_at: string; name: string; email: string; phone: string;
  country: string; service: string; format: string; preferred_date: string; preferred_time: string; timezone: string;
  starts_at: string; duration_minutes: number; message: string; consent: boolean; status: string;
  admin_notes: string | null; notification_status: string;
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

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getRecord<T>(table: 'contact_leads' | 'tool_leads' | 'bookings', id: string): Promise<T | null> {
  if (!uuid.test(id)) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Could not load the record.');
  return data as T | null;
}

export async function dashboardSummary() {
  const supabase = await createUserClient();
  const now = new Date().toISOString();
  const head = (table: string) => supabase.from(table).select('id', { count: 'exact', head: true });
  const total = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await query;
    if (error) throw new Error('Could not load dashboard totals.');
    return count ?? 0;
  };
  const [contactNew, contactTotal, toolNew, toolTotal, bookingsPending, bookingsUpcoming] = await Promise.all([
    total(head('contact_leads').eq('status', 'new')),
    total(head('contact_leads')),
    total(head('tool_leads').eq('status', 'new')),
    total(head('tool_leads')),
    total(head('bookings').eq('status', 'pending')),
    total(head('bookings').in('status', ['pending', 'confirmed']).gte('starts_at', now)),
  ]);
  const [recentContacts, recentTools, nextBookings] = await Promise.all([
    supabase.from('contact_leads').select('id, created_at, name, service, status').order('created_at', { ascending: false }).limit(5),
    supabase.from('tool_leads').select('id, created_at, name, tool_name, status').order('created_at', { ascending: false }).limit(5),
    supabase.from('bookings').select('id, reference, name, preferred_date, preferred_time, timezone, status').in('status', ['pending', 'confirmed']).gte('starts_at', now).order('starts_at').limit(5),
  ]);
  return {
    totals: { contactNew, contactTotal, toolNew, toolTotal, bookingsPending, bookingsUpcoming },
    recentContacts: (recentContacts.data ?? []) as Pick<ContactLead, 'id' | 'created_at' | 'name' | 'service' | 'status'>[],
    recentTools: (recentTools.data ?? []) as Pick<ToolLead, 'id' | 'created_at' | 'name' | 'tool_name' | 'status'>[],
    nextBookings: (nextBookings.data ?? []) as Pick<Booking, 'id' | 'reference' | 'name' | 'preferred_date' | 'preferred_time' | 'timezone' | 'status'>[],
  };
}
