import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, effectiveStatus, formatInvoiceDate, formatMoney, invoiceTotals, lineTotals, round2 } from '../src/lib/invoices/totals';
import { validateInvoice, validatePayment } from '../src/lib/invoices/validation';

test('Invoice totals: one line with 10% discount and one with 10% tax', () => {
  const lines = [
    { quantity: 1, rate: 100, discount_percent: 10, tax_percent: 0 },
    { quantity: 2, rate: 50, discount_percent: 0, tax_percent: 10 },
  ];
  assert.deepEqual(lineTotals(lines[0]), { gross: 100, discount: 10, amount: 90, tax: 0 });
  assert.deepEqual(invoiceTotals(lines, 50), { subtotal: 190, discount_total: 10, tax_total: 10, total: 200, amount_paid: 50, balance_due: 150 });
});

test('Rounding is to cents and avoids floating-point drift', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(0.1 + 0.2), 0.3);
  const t = invoiceTotals([{ quantity: 3, rate: 33.33, discount_percent: 12.5, tax_percent: 10 }]);
  assert.equal(t.subtotal, 87.49);
  assert.equal(t.tax_total, 8.75);
  assert.equal(t.total, 96.24);
});

test('Money, dates and overdue status format as specified', () => {
  assert.equal(formatMoney(1234.5), '$1,234.50');
  assert.equal(formatMoney(-5), '-$5.00');
  assert.equal(formatMoney(150000, 'PKR'), 'PKR 150,000.00');
  assert.equal(formatMoney(-2500.5, 'PKR'), '-PKR 2,500.50');
  assert.equal(formatInvoiceDate('2026-10-20'), '20 Oct 2026');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(effectiveStatus('sent', '2026-10-01', 10, '2026-10-20'), 'overdue');
  assert.equal(effectiveStatus('sent', '2026-10-01', 0, '2026-10-20'), 'sent');
  assert.equal(effectiveStatus('draft', '2026-10-01', 10, '2026-10-20'), 'draft');
});

test('Invoice validation requires customer, email, dates and at least one named item', () => {
  const valid = {
    bill_to_name: 'Client', bill_to_email: 'Client@Example.com', invoice_date: '2026-10-20', due_date: '2026-10-20',
    status: 'draft', line_items: [{ item_name: 'Consultation', quantity: 1, rate: 100 }],
  };
  const ok = validateInvoice(valid);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.data?.bill_to_email, 'client@example.com');
  assert.ok(validateInvoice({ ...valid, bill_to_name: '' }).errors.bill_to_name);
  assert.ok(validateInvoice({ ...valid, bill_to_email: 'x' }).errors.bill_to_email);
  assert.ok(validateInvoice({ ...valid, due_date: '2026-10-19' }).errors.due_date);
  assert.ok(validateInvoice({ ...valid, line_items: [] }).errors.line_items);
  assert.ok(validateInvoice({ ...valid, line_items: [{ item_name: '', rate: 5 }] }).errors.line_0);
  assert.ok(validateInvoice({ ...valid, line_items: [{ item_name: 'X', quantity: 1, rate: 5, discount_percent: 120 }] }).errors.line_0);
  assert.equal(validateInvoice({ ...valid, status: 'hacked' }).data?.status, 'draft');
  assert.equal(validateInvoice({ ...valid, currency: 'AUD' }).data?.currency, 'AUD');
  assert.equal(validateInvoice({ ...valid, currency: 'PKR' }).data?.currency, 'PKR');
  assert.equal(validateInvoice({ ...valid, currency: 'USD' }).data?.currency, 'PKR');
});

test('Payment validation', () => {
  assert.deepEqual(validatePayment({ amount: '50', payment_date: '2026-10-20', mode: 'Card' }).errors, {});
  assert.ok(validatePayment({ amount: 0, payment_date: '2026-10-20' }).errors.amount);
  assert.equal(validatePayment({ amount: 5, payment_date: '2026-10-20', mode: 'Bitcoin' }).data?.mode, 'Other');
});
