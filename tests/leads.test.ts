import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingInstant, bookingReference, validateBooking, validateToolLead } from '../src/lib/leads/validation';
import { bookingCategories } from '../src/features/consultation-booking/model';
import { company } from '../src/content/company';
import { navigation } from '../src/content/navigation';

const now = new Date('2026-10-14T06:00:00Z'); // Wednesday 11:00 in Asia/Karachi
const booking = {
  format: 'video', date: '2026-10-16', time: '10:30', name: 'Test Person', email: 'Person@Example.com',
  phone: '+92 300 1234567', country: 'Pakistan', category: bookingCategories[0], message: 'I would like advice on my options.',
  consent: true, idempotencyKey: '3b241101-e2bb-4255-8caf-4136c566a962',
};

test('A valid booking request is accepted and normalised', () => {
  const { data, errors } = validateBooking(booking, new Set(bookingCategories), now);
  assert.deepEqual(errors, {});
  assert.equal(data?.email, 'person@example.com');
  assert.equal(bookingInstant('2026-10-16', '10:30'), '2026-10-16T05:30:00.000Z');
  assert.match(bookingReference('3b241101-e2bb-4255-8caf-4136c566a962'), /^MF-3B241101$/);
});

test('Booking validation rejects weekends, past times, unknown categories, bots and missing keys', () => {
  const categories = new Set(bookingCategories);
  assert.ok(validateBooking({ ...booking, date: '2026-10-17' }, categories, now).errors.date);
  assert.ok(validateBooking({ ...booking, date: '2026-10-14', time: '09:00' }, categories, now).errors.time);
  assert.ok(validateBooking({ ...booking, time: '21:00' }, categories, now).errors.time);
  assert.ok(validateBooking({ ...booking, category: 'Invented service' }, categories, now).errors.category);
  assert.ok(validateBooking({ ...booking, idempotencyKey: 'x' }, categories, now).errors.form);
  assert.ok(validateBooking({ ...booking, website: 'spam' }, categories, now).errors.form);
  assert.ok(validateBooking({ ...booking, consent: false }, categories, now).errors.consent);
  assert.ok(validateBooking([], categories, now).errors.form);
});

test('Tool leads keep bounded answers and require a known tool and consent', () => {
  const tools = new Set(['pr-calculator']);
  const answers = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`q${i}`, 'x'.repeat(500)]));
  const { data, errors } = validateToolLead({ toolSlug: 'pr-calculator', name: 'Test Person', email: 'a@b.co', consent: true, answers: { ...answers, 'bad key!': 'y' } }, tools);
  assert.deepEqual(errors, {});
  assert.equal(Object.keys(data!.answers).length, 5);
  assert.equal(data!.answers.q0.length, 200);
  assert.ok(validateToolLead({ toolSlug: 'unknown', name: 'Test Person', email: 'a@b.co', consent: true }, tools).errors.form);
  assert.ok(validateToolLead({ toolSlug: 'pr-calculator', name: 'Test Person', email: 'a@b.co' }, tools).errors.consent);
  assert.ok(validateToolLead({ toolSlug: 'pr-calculator', name: 'Test Person', email: 'not-an-email', consent: true }, tools).errors.email);
});

test('Contact number, WhatsApp link and primary navigation use the supplied values', () => {
  assert.equal(company.phone, '+61 0450 635 162');
  assert.equal(company.tel, '+61450635162');
  assert.equal(company.whatsapp, 'https://wa.me/61450635162');
  assert.deepEqual(navigation.map(([name]) => name), ['Home', 'About', 'Tools', 'Services', 'Contact']);
});
