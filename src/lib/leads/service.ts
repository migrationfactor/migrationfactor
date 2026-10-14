import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { detailEmail, notificationRecipient, sendEmail, type EmailOutcome } from '@/lib/email/resend';
import { bookingInstant, bookingReference, bookingTimezone, type BookingData, type ToolLeadData } from '@/lib/leads/validation';
import { consultation } from '@/features/consultation-booking/model';
import type { EnquiryData } from '@/lib/enquiry-validation';
import { company } from '@/content/company';

export class SubmissionConflict extends Error {}

const day = () => new Date().toISOString().slice(0, 10);
const hash = (...parts: string[]) => createHash('sha256').update(parts.join('\u0000')).digest('hex');

function isUniqueViolation(error: { code?: string } | null, constraint?: string): boolean {
  if (!error || error.code !== '23505') return false;
  return constraint ? JSON.stringify(error).includes(constraint) : true;
}

async function recordNotification(table: string, id: string, outcome: EmailOutcome) {
  const { error } = await createServiceClient().from(table).update({ notification_status: outcome }).eq('id', id);
  if (error) console.warn('Could not record notification status for', table);
}

/** Saves a contact-form lead. An identical same-day resubmission returns the existing record. */
export async function saveContactLead(data: EnquiryData): Promise<{ id: string; duplicate: boolean; email: EmailOutcome }> {
  const supabase = createServiceClient();
  const dedupeKey = hash('contact', data.email.toLowerCase(), data.service, data.message, day());
  const { data: row, error } = await supabase
    .from('contact_leads')
    .insert({
      name: data.name, email: data.email.toLowerCase(), phone: data.phone || null, service: data.service,
      message: data.message, consent: data.consent, dedupe_key: dedupeKey,
    })
    .select('id')
    .single();
  if (isUniqueViolation(error, 'contact_leads_dedupe_idx')) {
    const { data: existing } = await supabase.from('contact_leads').select('id').eq('dedupe_key', dedupeKey).single();
    if (existing) return { id: existing.id, duplicate: true, email: 'skipped' };
  }
  if (error || !row) throw new Error('Contact lead insert failed');

  const mail = detailEmail('New website enquiry', [
    ['Name', data.name], ['Email', data.email], ['Phone', data.phone], ['Service', data.service], ['Message', data.message],
  ], 'Open the admin panel to update this lead.');
  const outcome = await sendEmail({ to: notificationRecipient(), subject: `New enquiry: ${data.service} — ${data.name}`, replyTo: data.email, ...mail });
  await recordNotification('contact_leads', row.id, outcome);
  return { id: row.id, duplicate: false, email: outcome };
}

/** Saves a lead generated from a migration/visa tool, including the visitor's answers and result. */
export async function saveToolLead(
  data: ToolLeadData & { toolName: string }
): Promise<{ id: string; duplicate: boolean; email: EmailOutcome }> {
  const supabase = createServiceClient();
  const dedupeKey = hash('tool', data.toolSlug, data.email, JSON.stringify(data.answers), data.resultSummary, day());
  const { data: row, error } = await supabase
    .from('tool_leads')
    .insert({
      tool_slug: data.toolSlug, tool_name: data.toolName, name: data.name, email: data.email,
      phone: data.phone || null, message: data.message || null, answers: data.answers,
      result_summary: data.resultSummary || null, consent: data.consent, dedupe_key: dedupeKey,
    })
    .select('id')
    .single();
  if (isUniqueViolation(error, 'tool_leads_dedupe_idx')) {
    const { data: existing } = await supabase.from('tool_leads').select('id').eq('dedupe_key', dedupeKey).single();
    if (existing) return { id: existing.id, duplicate: true, email: 'skipped' };
  }
  if (error || !row) throw new Error('Tool lead insert failed');

  const mail = detailEmail(`New ${data.toolName} lead`, [
    ['Tool', data.toolName], ['Name', data.name], ['Email', data.email], ['Phone', data.phone],
    ['Note', data.message], ['Result', data.resultSummary],
  ], 'Open the admin panel for the full answers.');
  const outcome = await sendEmail({ to: notificationRecipient(), subject: `New tool lead: ${data.toolName} — ${data.name}`, replyTo: data.email, ...mail });
  await recordNotification('tool_leads', row.id, outcome);
  return { id: row.id, duplicate: false, email: outcome };
}

const formatLabel = (format: string) => (format === 'phone' ? 'Phone' : 'Video');

/**
 * Saves a consultation booking request. Retries with the same idempotency key return the
 * original request; a second active request for the same person and time is rejected.
 */
export async function saveBooking(data: BookingData): Promise<{ id: string; reference: string; duplicate: boolean; email: EmailOutcome }> {
  const supabase = createServiceClient();
  const startsAt = bookingInstant(data.date, data.time);

  const { data: retried } = await supabase.from('bookings').select('id, reference').eq('idempotency_key', data.idempotencyKey).maybeSingle();
  if (retried) return { id: retried.id, reference: retried.reference, duplicate: true, email: 'skipped' };

  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('email', data.email)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', new Date().toISOString());
  if ((count ?? 0) >= 3) {
    throw new SubmissionConflict('You already have several upcoming consultation requests. Our team will contact you about them.');
  }

  const id = randomUUID();
  const reference = bookingReference(id);
  const { error } = await supabase.from('bookings').insert({
    id, reference, name: data.name, email: data.email, phone: data.phone, country: data.country,
    service: data.category, format: data.format, preferred_date: data.date, preferred_time: data.time,
    timezone: bookingTimezone, starts_at: startsAt, duration_minutes: consultation.minutes,
    message: data.message, consent: data.consent, idempotency_key: data.idempotencyKey,
  });
  if (isUniqueViolation(error, 'bookings_idempotency_key_key')) {
    const { data: existing } = await supabase.from('bookings').select('id, reference').eq('idempotency_key', data.idempotencyKey).single();
    if (existing) return { id: existing.id, reference: existing.reference, duplicate: true, email: 'skipped' };
  }
  if (isUniqueViolation(error, 'bookings_person_slot_idx')) {
    throw new SubmissionConflict('You already have a consultation request for this date and time.');
  }
  if (error) throw new Error('Booking insert failed');

  const when = `${data.date} at ${data.time} (${bookingTimezone}, UTC+5)`;
  const rows: [string, string][] = [
    ['Reference', reference], ['Status', 'Pending confirmation'], ['Requested time', when],
    ['Format', formatLabel(data.format)], ['Name', data.name], ['Email', data.email], ['Phone', data.phone],
    ['Country', data.country], ['Category', data.category], ['Enquiry', data.message],
  ];
  const adminMail = detailEmail('New consultation booking request', rows, 'Confirm or update this request in the admin panel.');
  const outcome = await sendEmail({ to: notificationRecipient(), subject: `Booking request ${reference}: ${when}`, replyTo: data.email, ...adminMail });
  await recordNotification('bookings', id, outcome);

  const visitorMail = detailEmail('We received your consultation request', rows.slice(0, 5),
    `This is a request, not a confirmed appointment. Our team will contact you to confirm the time. Questions: ${company.email} or ${company.phone}.`);
  await sendEmail({ to: data.email, subject: `Consultation request received — ${reference}`, replyTo: company.email, ...visitorMail });

  return { id, reference, duplicate: false, email: outcome };
}

/** Tells the client when an admin confirms or cancels their request. */
export async function sendBookingStatusEmail(booking: {
  reference: string; email: string; name: string; preferred_date: string; preferred_time: string; timezone: string; format: string;
}, status: 'confirmed' | 'cancelled'): Promise<EmailOutcome> {
  const time = booking.preferred_time.slice(0, 5);
  const when = `${booking.preferred_date} at ${time} (${booking.timezone})`;
  const heading = status === 'confirmed' ? 'Your consultation is confirmed' : 'Your consultation request was cancelled';
  const footer = status === 'confirmed'
    ? `We will contact you by ${booking.format === 'phone' ? 'phone' : 'email with video details'} at the confirmed time. To change it, contact ${company.email} or ${company.phone}.`
    : `To arrange another time, contact ${company.email} or ${company.phone}.`;
  const mail = detailEmail(heading, [['Reference', booking.reference], ['Name', booking.name], ['Time', when], ['Format', formatLabel(booking.format)]], footer);
  return sendEmail({ to: booking.email, subject: `${heading} — ${booking.reference}`, replyTo: company.email, ...mail });
}
