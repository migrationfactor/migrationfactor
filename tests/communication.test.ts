import test from 'node:test';
import assert from 'node:assert/strict';
import { normalisePhone, validateCommunication } from '../src/lib/leads/communication';

const base = { channel: 'whatsapp', visitorId: '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b', name: 'Ali Khan', email: '', topic: '', message: '', consent: true, website: '' };

test('WhatsApp enquiries need a name and a valid phone number', () => {
  assert.deepEqual(validateCommunication({ ...base, phone: '0450 635 162' }).errors, {});
  assert.deepEqual(validateCommunication({ ...base, phone: '+92 300 1234567', topic: 'Student visa' }).errors, {});
  assert.ok(validateCommunication({ ...base, phone: '' }).errors.phone);
  assert.ok(validateCommunication({ ...base, phone: '12345' }).errors.phone);
  assert.ok(validateCommunication({ ...base, phone: 'call me' }).errors.phone);
  assert.ok(validateCommunication({ ...base, name: 'A', phone: '0450635162' }).errors.name);
  assert.ok(validateCommunication({ ...base, phone: '0450635162', website: 'spam' }).errors.form);
});

test('Email enquiries accept an optional phone number', () => {
  const email = { ...base, channel: 'email', email: 'client@example.com', message: 'I need help with a student visa.' };
  assert.deepEqual(validateCommunication(email).errors, {});
  assert.deepEqual(validateCommunication({ ...email, phone: '0450 635 162' }).errors, {});
  assert.ok(validateCommunication({ ...email, phone: 'abc' }).errors.phone);
});

test('Phone numbers in different formats map to the same lead', () => {
  assert.equal(normalisePhone('0450 635 162'), normalisePhone('0450-635-162'));
  assert.equal(normalisePhone('+61 (450) 635 162'), '+61450635162');
});
