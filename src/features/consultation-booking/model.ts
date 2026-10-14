import { services } from '@/content/services';
export const consultation = { minutes: 30, timezone: 'Asia/Karachi', hours: 'Monday–Friday, 9am–9pm Pakistan time', price: 'Free' } as const;
export const preferenceTimes = Array.from({ length: 24 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
export const bookingCategories = [...services.map(service => service.name), 'Not sure yet'];
export interface ConsultationDetails {
  format: string; date: string; time: string; name: string; email: string;
  phone: string; country: string; category: string; message: string; consent: boolean;
}
export const emptyConsultation: ConsultationDetails = { format: '', date: '', time: '', name: '', email: '', phone: '', country: '', category: '', message: '', consent: false };
export function pakistanDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: consultation.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validateConsultation(value: ConsultationDetails, now = new Date()) {
  const errors: Record<string, string> = {};
  if (!['phone', 'video'].includes(value.format)) errors.format = 'Choose phone or video.';
  const date = new Date(`${value.date}T12:00:00+05:00`);
  const weekday = date.getUTCDay();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value.date || weekday === 0 || weekday === 6 || value.date < pakistanDate(now)) errors.date = 'Choose a future Monday–Friday date.';
  if (!preferenceTimes.includes(value.time) || +new Date(`${value.date}T${value.time}:00+05:00`) <= +now) errors.time = 'Choose a future time between 9am and 8:30pm Pakistan time.';
  if (value.name.trim().length < 2 || value.name.length > 100) errors.name = 'Enter your full name (2–100 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 254) errors.email = 'Enter a valid email address.';
  if (!/^\+[1-9]\d{6,14}$/.test(value.phone.replace(/[\s()-]/g, ''))) errors.phone = 'Include the country code, for example +92 300 1234567.';
  if (value.country.trim().length < 2 || value.country.length > 80) errors.country = 'Enter your country of residence.';
  if (!value.category || value.category.length > 100) errors.category = 'Choose an enquiry category.';
  if (value.message.trim().length < 10 || value.message.length > 1500) errors.message = 'Briefly describe your enquiry (10–1,500 characters).';
  if (!value.consent) errors.consent = 'Please acknowledge how your details are used.';
  return errors;
}
