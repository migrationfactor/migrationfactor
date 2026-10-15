/** Shared validation for explicitly submitted website WhatsApp/email enquiries. */
export const communicationTopics = ['Book a consultation', 'Student visa', 'Skilled & PR visa', 'Partner & family visa', 'Visa refusal or appeal'] as const;
export type CommunicationChannel = 'whatsapp' | 'email';
export type CommunicationSource = 'whatsapp_form' | 'email_form' | 'whatsapp_inbound' | 'email_inbound';
export interface CommunicationInput {
  channel: CommunicationChannel; visitorId: string; name: string; email: string; phone: string; topic: string; message: string; consent: boolean;
}
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Digits with an optional leading +, so "0450 635 162" and "0450635162" match the same lead. */
export function normalisePhone(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}
function validPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return /^\+?[\d\s()-]+$/.test(phone) && digits.length >= 8 && digits.length <= 15 && phone.length <= 40;
}

export function validateCommunication(input: unknown) {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { data: null, errors: { form: 'Invalid enquiry.' } as Record<string, string> };
  const raw = input as Record<string, unknown>;
  const channel = raw.channel === 'email' ? 'email' : 'whatsapp';
  const data: CommunicationInput = { channel, visitorId: clean(raw.visitorId), name: clean(raw.name), email: clean(raw.email).toLowerCase(),
    phone: clean(raw.phone), topic: clean(raw.topic), message: clean(raw.message), consent: raw.consent === true };
  if (!['whatsapp', 'email'].includes(String(raw.channel))) errors.form = 'Choose a valid contact method.';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.visitorId)) errors.form = 'Please refresh and try again.';
  if (data.name.length < 2 || data.name.length > 100 || /[\u0000-\u001f]/.test(data.name)) errors.name = 'Enter your name (2–100 characters).';
  if (channel === 'whatsapp' && !validPhone(data.phone)) errors.phone = 'Enter your phone number, including the country code if outside Australia.';
  if (channel === 'email' && data.phone && !validPhone(data.phone)) errors.phone = 'Enter a valid phone number or leave it blank.';
  if (data.topic && !(communicationTopics as readonly string[]).includes(data.topic)) errors.topic = 'Choose a listed topic.';
  if (channel === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254)) errors.email = 'Enter a valid email address.';
  if (channel === 'email' && (data.message.length < 10 || data.message.length > 3000)) errors.message = 'Enter your enquiry (10–3,000 characters).';
  if (data.message.length > 3000) errors.message = 'Keep your enquiry under 3,000 characters.';
  if (!data.consent) errors.consent = 'Please agree before sending your details.';
  if (clean(raw.website)) errors.form = 'This request could not be accepted.';
  return { data, errors };
}
export function communicationSourceLabel(source: string): string {
  return ({ whatsapp_form: 'Website WhatsApp enquiry', email_form: 'Website email enquiry', whatsapp_inbound: 'Received WhatsApp message', email_inbound: 'Received email' } as Record<string, string>)[source] || source;
}
