/** Dependency-free validation for tool leads and booking requests (browser and server). */
import { validateConsultation, consultation, type ConsultationDetails } from '@/features/consultation-booking/model';

export const leadStatuses = ['new', 'contacted', 'qualified', 'closed', 'spam'] as const;
export const bookingStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type LeadStatus = typeof leadStatuses[number];
export type BookingStatus = typeof bookingStatuses[number];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export interface ToolLeadData {
  toolSlug: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  answers: Record<string, string>;
  resultSummary: string;
  consent: boolean;
}

export function validateToolLead(input: unknown, toolSlugs: Set<string>) {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { data: null, errors: { form: 'Invalid request.' } as Record<string, string> };
  }
  const raw = input as Record<string, unknown>;
  const answers: Record<string, string> = {};
  if (raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)) {
    const entries = Object.entries(raw.answers as Record<string, unknown>);
    if (entries.length > 40) errors.form = 'Too many answers were submitted.';
    for (const [key, value] of entries.slice(0, 40)) {
      if (/^[A-Za-z0-9_-]{1,60}$/.test(key) && (typeof value === 'string' || typeof value === 'number')) {
        answers[key] = String(value).slice(0, 200);
      }
    }
  }
  const data: ToolLeadData = {
    toolSlug: text(raw.toolSlug),
    name: text(raw.name),
    email: text(raw.email).toLowerCase(),
    phone: text(raw.phone),
    message: text(raw.message),
    answers,
    resultSummary: text(raw.resultSummary).slice(0, 6000),
    consent: raw.consent === true,
  };
  if (!toolSlugs.has(data.toolSlug)) errors.form = 'Unknown tool.';
  if (data.name.length < 2 || data.name.length > 100) errors.name = 'Please enter your full name (2–100 characters).';
  if (!emailPattern.test(data.email) || data.email.length > 254) errors.email = 'Please enter a valid email address.';
  if (data.phone && !/^[+\d\s().-]{6,40}$/.test(data.phone)) errors.phone = 'Please enter a valid phone number.';
  if (data.message.length > 1500) errors.message = 'Please keep your note under 1,500 characters.';
  if (!data.consent) errors.consent = 'Please agree before sending your result.';
  if (text(raw.website)) errors.form = 'This request could not be accepted.';
  return { data, errors };
}

export interface BookingData extends ConsultationDetails {
  idempotencyKey: string;
}

export function validateBooking(input: unknown, categories: Set<string>, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { data: null, errors: { form: 'Invalid request.' } as Record<string, string> };
  }
  const raw = input as Record<string, unknown>;
  const data: BookingData = {
    format: text(raw.format),
    date: text(raw.date),
    time: text(raw.time),
    name: text(raw.name),
    email: text(raw.email).toLowerCase(),
    phone: text(raw.phone),
    country: text(raw.country),
    category: text(raw.category),
    message: text(raw.message),
    consent: raw.consent === true,
    idempotencyKey: text(raw.idempotencyKey),
  };
  const errors = validateConsultation(data, now);
  if (!errors.category && !categories.has(data.category)) errors.category = 'Choose a listed category.';
  if (!uuidPattern.test(data.idempotencyKey)) errors.form = 'Please refresh the page and try again.';
  if (text(raw.website)) errors.form = 'This request could not be accepted.';
  return { data, errors };
}

/** Converts the Pakistan-time preference into an exact instant. */
export function bookingInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}

export function bookingReference(id: string): string {
  return `MF-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export const bookingTimezone = consultation.timezone;
