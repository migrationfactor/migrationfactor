/** Dependency-free validation for invoice forms (browser and server). */
import { currencies, invoiceStatuses, type Currency, type InvoiceStatus } from './totals';

export interface LineItemInput {
  item_name: string;
  description: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
}

export interface InvoiceInput {
  bill_to_name: string;
  bill_to_email: string;
  bill_to_phone: string;
  bill_to_address: string;
  booking_id: string | null;
  status: InvoiceStatus;
  currency: Currency;
  invoice_date: string;
  due_date: string;
  terms: string;
  notes: string;
  line_items: LineItemInput[];
}

export interface PaymentInput {
  amount: number;
  payment_date: string;
  mode: string;
  reference_number: string;
  notes: string;
}

export const paymentModes = ['Cash', 'Bank Transfer', 'Card', 'Stripe', 'Other'] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim() || 0);
  return Number.isFinite(n) ? n : NaN;
};

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function validateInvoice(input: unknown): { data: InvoiceInput | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { data: null, errors: { form: 'Invalid invoice.' } };
  const raw = input as Record<string, unknown>;
  const rawLines = Array.isArray(raw.line_items) ? raw.line_items.slice(0, 200) : [];
  const line_items: LineItemInput[] = rawLines.map((line) => {
    const l = (line && typeof line === 'object' ? line : {}) as Record<string, unknown>;
    return {
      item_name: text(l.item_name, 160),
      description: text(l.description, 1000),
      quantity: num(l.quantity),
      rate: num(l.rate),
      discount_percent: num(l.discount_percent),
      tax_percent: num(l.tax_percent),
    };
  }).filter((l) => l.item_name || l.description || l.rate);

  const status = text(raw.status, 20) as InvoiceStatus;
  const currency = text(raw.currency, 3) as Currency;
  const data: InvoiceInput = {
    bill_to_name: text(raw.bill_to_name, 160),
    bill_to_email: text(raw.bill_to_email, 254).toLowerCase(),
    bill_to_phone: text(raw.bill_to_phone, 40),
    bill_to_address: text(raw.bill_to_address, 1000),
    booking_id: isUuid(raw.booking_id) ? raw.booking_id : null,
    status: (invoiceStatuses as readonly string[]).includes(status) ? status : 'draft',
    currency: (currencies as readonly string[]).includes(currency) ? currency : currencies[0],
    invoice_date: text(raw.invoice_date, 10),
    due_date: text(raw.due_date, 10),
    terms: text(raw.terms, 80) || 'Due on Receipt',
    notes: text(raw.notes, 4000),
    line_items,
  };

  if (!data.bill_to_name) errors.bill_to_name = 'Enter the customer name.';
  if (!emailPattern.test(data.bill_to_email)) errors.bill_to_email = 'Enter a valid email address.';
  if (data.bill_to_phone && !/^[+\d\s().-]{6,40}$/.test(data.bill_to_phone)) errors.bill_to_phone = 'Enter a valid phone number.';
  if (!isIsoDate(data.invoice_date)) errors.invoice_date = 'Choose the invoice date.';
  if (!isIsoDate(data.due_date)) errors.due_date = 'Choose the due date.';
  else if (isIsoDate(data.invoice_date) && data.due_date < data.invoice_date) errors.due_date = 'The due date cannot be before the invoice date.';
  if (!line_items.length) errors.line_items = 'Add at least one item.';
  line_items.forEach((line, i) => {
    if (!line.item_name) errors[`line_${i}`] = `Row ${i + 1}: enter an item name.`;
    else if (!(line.quantity > 0) || line.quantity > 100000) errors[`line_${i}`] = `Row ${i + 1}: quantity must be more than 0.`;
    else if (!(line.rate >= 0) || line.rate > 10000000) errors[`line_${i}`] = `Row ${i + 1}: enter a valid rate.`;
    else if (!(line.discount_percent >= 0 && line.discount_percent <= 100)) errors[`line_${i}`] = `Row ${i + 1}: discount must be 0–100%.`;
    else if (!(line.tax_percent >= 0 && line.tax_percent <= 100)) errors[`line_${i}`] = `Row ${i + 1}: tax must be 0–100%.`;
  });
  return { data, errors };
}

export function validatePayment(input: unknown): { data: PaymentInput | null; errors: Record<string, string> } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { data: null, errors: { form: 'Invalid payment.' } };
  const raw = input as Record<string, unknown>;
  const mode = text(raw.mode, 40);
  const data: PaymentInput = {
    amount: num(raw.amount),
    payment_date: text(raw.payment_date, 10),
    mode: (paymentModes as readonly string[]).includes(mode) ? mode : 'Other',
    reference_number: text(raw.reference_number, 120),
    notes: text(raw.notes, 1000),
  };
  const errors: Record<string, string> = {};
  if (!(data.amount > 0) || data.amount > 10000000) errors.amount = 'Enter an amount greater than 0.';
  if (!isIsoDate(data.payment_date)) errors.payment_date = 'Choose the payment date.';
  return { data, errors };
}
