import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFieldValues, formatSignDate, isToken, sanitizeFields, splitName, type SignField } from '../src/lib/signatures/fields';

test('Tokens must be exactly 64 lowercase hex characters', () => {
  assert.equal(isToken('a'.repeat(64)), true);
  assert.equal(isToken('A'.repeat(64)), false);
  assert.equal(isToken('a'.repeat(63)), false);
  assert.equal(isToken("' or 1=1 --"), false);
  assert.equal(isToken(undefined), false);
});

test('Editor fields are sanitised: unknown types, bad pages and duplicates dropped; boxes clamped and rounded', () => {
  const fields = sanitizeFields([
    { id: 'a1', type: 'signature', page: 1, x: 95.1234, y: -5, w: 24, h: 4 },
    { id: 'a1', type: 'text', page: 1, x: 1, y: 1, w: 10, h: 2 },
    { id: 'b2', type: 'script', page: 1, x: 1, y: 1, w: 10, h: 2 },
    { id: 'c3', type: 'text', page: 9, x: 1, y: 1, w: 10, h: 2 },
    { id: 'bad id!', type: 'text', page: 1 },
    { id: 'd4', type: 'checkbox', page: 2, x: 10, y: 10, w: 3, h: 2, label: '  Agree  ' },
  ], 2);
  assert.deepEqual(fields.map((f) => f.id), ['a1', 'd4']);
  assert.deepEqual([fields[0].x, fields[0].y], [76, 0]);
  assert.equal(fields[1].required, false);
  assert.equal(fields[1].label, 'Agree');
  assert.deepEqual(sanitizeFields('nope', 1), []);
});

test('Only values for existing fields are accepted and required fields are enforced', () => {
  const fields: SignField[] = [
    { id: 's', type: 'signature', page: 1, x: 0, y: 0, w: 10, h: 4 },
    { id: 'd', type: 'sign_date', page: 1, x: 0, y: 10, w: 10, h: 2 },
    { id: 't', type: 'text', page: 1, x: 0, y: 20, w: 10, h: 2, label: 'Address' },
    { id: 'c', type: 'checkbox', page: 1, x: 0, y: 30, w: 3, h: 2 },
  ];
  const ok = applyFieldValues(fields, { d: '2026-10-21', t: ' 1 Main St ', c: true, injected: 'x', s: { x: 0 } }, true, false);
  assert.equal(ok.missing, null);
  assert.deepEqual(ok.fields.map((f) => f.value), ['signed', '21/10/2026', '1 Main St', true]);
  assert.equal(ok.fields.some((f) => f.id === 'injected'), false);
  assert.equal(ok.fields[0].x, 0, 'coordinates come from the stored request, not the browser');
  assert.equal(applyFieldValues(fields, { d: '21/10/2026' }, true, false).missing?.id, 't');
  assert.equal(applyFieldValues(fields, { d: '21/10/2026', t: 'x' }, false, false).missing?.id, 's');
});

test('Dates and names', () => {
  assert.equal(formatSignDate('2026-01-05'), '05/01/2026');
  assert.match(formatSignDate(new Date('2026-10-21T02:00:00Z')), /^21\/10\/2026$/);
  assert.deepEqual(splitName('Ali Raza Khan'), { first: 'Ali', last: 'Raza Khan' });
});
