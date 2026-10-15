'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';
import { requireAdmin } from '@/lib/admin/auth';
import { bookingStatuses, leadStatuses } from '@/lib/leads/validation';
import { sendBookingStatusEmail } from '@/lib/leads/service';
import type { Booking } from '@/lib/admin/queries';

export interface ActionState {
  ok?: boolean;
  message?: string;
  email?: string;
}

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!supabaseConfigured()) return { message: 'Supabase is not configured on this server.' };
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 200) {
    return { message: 'Enter your admin email and password.', email };
  }
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { message: 'Incorrect email or password.', email };
  const { data: membership } = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!membership) {
    await supabase.auth.signOut();
    return { message: 'This account does not have admin access.', email };
  }
  redirect('/admin');
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readUpdate(formData: FormData, allowed: readonly string[]) {
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  const notes = String(formData.get('admin_notes') || '').trim();
  if (!uuid.test(id) || !allowed.includes(status)) return { error: 'Choose a valid status.' } as const;
  if (notes.length > 4000) return { error: 'Notes must be 4,000 characters or fewer.' } as const;
  return { id, status, notes } as const;
}

export async function updateLead(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const requested = formData.get('table');
  const table = requested === 'tool_leads' || requested === 'communication_leads' ? requested : 'contact_leads';
  const input = readUpdate(formData, leadStatuses);
  if ('error' in input) return { message: input.error };
  const supabase = await createUserClient();
  const { data, error } = await supabase.from(table).update({ status: input.status, admin_notes: input.notes || null }).eq('id', input.id).select('id');
  if (error || !data?.length) return { message: 'The lead could not be updated. Please try again.' };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: 'Lead updated.' };
}

export async function updateBooking(_state: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const input = readUpdate(formData, bookingStatuses);
  if ('error' in input) return { message: input.error };
  const notify = formData.get('notify') === 'on';
  const supabase = await createUserClient();
  const { data: previous } = await supabase.from('bookings').select('status').eq('id', input.id).maybeSingle();
  if (!previous) return { message: 'Booking not found.' };
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: input.status, admin_notes: input.notes || null })
    .eq('id', input.id)
    .select('*');
  if (error?.code === '23505') return { message: 'Another booking is already confirmed for this time. Choose a different time with the client first.' };
  if (error || !data?.length) return { message: 'The booking could not be updated. Please try again.' };
  revalidatePath('/admin', 'layout');

  const booking = data[0] as Booking;
  const changed = previous.status !== input.status;
  if (notify && changed && (input.status === 'confirmed' || input.status === 'cancelled')) {
    const outcome = await sendBookingStatusEmail(booking, input.status);
    return {
      ok: true,
      message: outcome === 'sent'
        ? `Booking updated and the client was emailed (${booking.email}).`
        : `Booking updated, but the client email was not sent (${outcome}). Please contact them directly.`,
    };
  }
  return { ok: true, message: 'Booking updated.' };
}
