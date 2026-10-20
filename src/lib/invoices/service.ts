import 'server-only';
import { createUserClient } from '@/lib/supabase/server';
import { getSettings } from './settings';
import { addDays, businessToday, invoiceTotals, lineTotals, round2, type Currency, type InvoiceStatus } from './totals';
import type { InvoiceInput, PaymentInput } from './validation';

// All queries run as the signed-in user, so the admin-only RLS policies apply to every call.

export interface InvoiceLineItem {
  id: string; invoice_id: string; item_name: string; description: string | null; quantity: number; rate: number;
  discount_percent: number; tax_percent: number; amount: number; sort_order: number;
}
export interface InvoicePayment {
  id: string; invoice_id: string; amount: number; payment_date: string; mode: string;
  reference_number: string | null; notes: string | null; created_at: string;
}
export interface Invoice {
  id: string; invoice_number: string; bill_to_name: string; bill_to_email: string; bill_to_phone: string | null;
  bill_to_address: string | null; booking_id: string | null; status: InvoiceStatus; currency: Currency; invoice_date: string; due_date: string;
  terms: string; subtotal: number; discount_total: number; tax_total: number; total: number; amount_paid: number;
  balance_due: number; notes: string | null; sent_at: string | null; paid_at: string | null; created_at: string; updated_at: string;
}
export interface InvoiceWithItems extends Invoice { line_items: InvoiceLineItem[]; payments: InvoicePayment[] }
export interface CatalogItem { id: string; name: string; description: string | null; default_rate: number; is_active: boolean; created_at: string }
export interface CustomerSuggestion { name: string; email: string; phone: string }

// Postgres numeric arrives as a string; normalise to numbers once.
const moneyFields = ['subtotal', 'discount_total', 'tax_total', 'total', 'amount_paid', 'balance_due'] as const;
function toInvoice<T extends Record<string, unknown>>(row: T): T {
  const copy: Record<string, unknown> = { ...row };
  for (const key of moneyFields) if (key in copy) copy[key] = Number(copy[key]);
  return copy as T;
}
function toLine(row: Record<string, unknown>): InvoiceLineItem {
  return { ...row, quantity: Number(row.quantity), rate: Number(row.rate), discount_percent: Number(row.discount_percent), tax_percent: Number(row.tax_percent), amount: Number(row.amount) } as InvoiceLineItem;
}

export async function generateInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc('next_invoice_number');
  if (error || typeof data !== 'string') return `${settings.invoice_prefix}${Date.now()}`;
  return `${settings.invoice_prefix}${data}`;
}

export async function listInvoices(): Promise<Invoice[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error('Could not load invoices.');
  return (data ?? []).map((row) => toInvoice(row) as Invoice);
}

export async function getInvoiceById(id: string): Promise<InvoiceWithItems | null> {
  const supabase = await createUserClient();
  const [invoice, lines, payments] = await Promise.all([
    supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
    supabase.from('invoice_line_items').select('*').eq('invoice_id', id).order('sort_order'),
    supabase.from('invoice_payments').select('*').eq('invoice_id', id).order('payment_date').order('created_at'),
  ]);
  if (invoice.error || lines.error || payments.error) throw new Error('Could not load the invoice.');
  if (!invoice.data) return null;
  return {
    ...(toInvoice(invoice.data) as Invoice),
    line_items: (lines.data ?? []).map(toLine),
    payments: (payments.data ?? []).map((p) => ({ ...p, amount: Number(p.amount) }) as InvoicePayment),
  };
}

export async function getInvoiceByBookingId(bookingId: string): Promise<Invoice | null> {
  const supabase = await createUserClient();
  const { data } = await supabase.from('invoices').select('*').eq('booking_id', bookingId).order('created_at').limit(1).maybeSingle();
  return data ? (toInvoice(data) as Invoice) : null;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export async function getCatalogItems(includeInactive = false): Promise<CatalogItem[]> {
  const supabase = await createUserClient();
  let query = supabase.from('invoice_catalog_items').select('*').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw new Error('Could not load the item catalog.');
  return (data ?? []).map((row) => ({ ...row, default_rate: Number(row.default_rate) }) as CatalogItem);
}

export async function createCatalogItem(item: { name: string; description: string; default_rate: number }) {
  const supabase = await createUserClient();
  const { error } = await supabase.from('invoice_catalog_items').insert({ name: item.name, description: item.description || null, default_rate: round2(item.default_rate) });
  if (error) throw new Error('Could not add the item.');
}

export async function updateCatalogItem(id: string, item: { name: string; description: string; default_rate: number; is_active: boolean }) {
  const supabase = await createUserClient();
  const { error } = await supabase.from('invoice_catalog_items')
    .update({ name: item.name, description: item.description || null, default_rate: round2(item.default_rate), is_active: item.is_active }).eq('id', id);
  if (error) throw new Error('Could not update the item.');
}

export async function deleteCatalogItem(id: string) {
  const supabase = await createUserClient();
  const { error } = await supabase.from('invoice_catalog_items').delete().eq('id', id);
  if (error) throw new Error('Could not delete the item.');
}

/** Distinct-by-email contacts from bookings, contact leads and past invoices for the customer autocomplete. */
export async function getCustomerSuggestions(): Promise<CustomerSuggestion[]> {
  const supabase = await createUserClient();
  const [bookings, contacts, invoices] = await Promise.all([
    supabase.from('bookings').select('name, email, phone').order('created_at', { ascending: false }).limit(500),
    supabase.from('contact_leads').select('name, email, phone').order('created_at', { ascending: false }).limit(500),
    supabase.from('invoices').select('bill_to_name, bill_to_email, bill_to_phone').order('created_at', { ascending: false }).limit(200),
  ]);
  const seen = new Map<string, CustomerSuggestion>();
  const add = (name: string | null, email: string | null, phone: string | null) => {
    const key = (email || '').toLowerCase();
    if (!key || !name || seen.has(key)) return;
    seen.set(key, { name, email: key, phone: phone || '' });
  };
  (invoices.data ?? []).forEach((r) => add(r.bill_to_name, r.bill_to_email, r.bill_to_phone));
  (bookings.data ?? []).forEach((r) => add(r.name, r.email, r.phone));
  (contacts.data ?? []).forEach((r) => add(r.name, r.email, r.phone));
  return [...seen.values()];
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------
function lineRows(invoiceId: string, input: InvoiceInput) {
  return input.line_items.map((line, index) => ({
    invoice_id: invoiceId,
    item_name: line.item_name,
    description: line.description || null,
    quantity: round2(line.quantity),
    rate: round2(line.rate),
    discount_percent: round2(line.discount_percent),
    tax_percent: round2(line.tax_percent),
    amount: lineTotals(line).amount,
    sort_order: index,
  }));
}

export async function createInvoice(input: InvoiceInput): Promise<string> {
  const settings = await getSettings();
  const supabase = await createUserClient();
  const invoiceNumber = await generateInvoiceNumber();
  const totals = invoiceTotals(input.line_items);
  const paid = input.status === 'paid';
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    bill_to_name: input.bill_to_name, bill_to_email: input.bill_to_email,
    bill_to_phone: input.bill_to_phone || null, bill_to_address: input.bill_to_address || null,
    booking_id: input.booking_id, status: input.status, currency: input.currency,
    invoice_date: input.invoice_date, due_date: input.due_date,
    terms: input.terms || settings.invoice_default_terms,
    notes: input.notes || settings.invoice_notes,
    ...totals,
    amount_paid: paid ? totals.total : 0,
    balance_due: paid ? 0 : totals.total,
    sent_at: input.status === 'sent' ? now : null,
    paid_at: paid ? now : null,
  }).select('id').single();
  if (error || !data) throw new Error('Could not create the invoice.');
  const { error: lineError } = await supabase.from('invoice_line_items').insert(lineRows(data.id, input));
  if (lineError) {
    await supabase.from('invoices').delete().eq('id', data.id);
    throw new Error('Could not save the invoice items.');
  }
  return data.id;
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<void> {
  const supabase = await createUserClient();
  const existing = await getInvoiceById(id);
  if (!existing) throw new Error('Invoice not found.');
  const recorded = round2(existing.payments.reduce((sum, p) => sum + p.amount, 0));
  const totals = invoiceTotals(input.line_items, recorded);
  // Only auto-fill the payment when marking paid with nothing recorded yet.
  const amountPaid = input.status === 'paid' && recorded === 0 ? totals.total : recorded;
  const now = new Date().toISOString();
  const { error } = await supabase.from('invoices').update({
    bill_to_name: input.bill_to_name, bill_to_email: input.bill_to_email,
    bill_to_phone: input.bill_to_phone || null, bill_to_address: input.bill_to_address || null,
    booking_id: input.booking_id ?? existing.booking_id, status: input.status, currency: input.currency,
    invoice_date: input.invoice_date, due_date: input.due_date, terms: input.terms, notes: input.notes || null,
    ...totals,
    amount_paid: amountPaid,
    balance_due: Math.max(round2(totals.total - amountPaid), 0),
    sent_at: existing.sent_at ?? (input.status === 'sent' ? now : null),
    paid_at: input.status === 'paid' ? existing.paid_at ?? now : existing.paid_at,
  }).eq('id', id);
  if (error) throw new Error('Could not update the invoice.');
  const { error: deleteError } = await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
  if (deleteError) throw new Error('Could not update the invoice items.');
  const { error: lineError } = await supabase.from('invoice_line_items').insert(lineRows(id, input));
  if (lineError) throw new Error('Could not update the invoice items.');
}

export async function updateStatus(id: string, status: InvoiceStatus): Promise<void> {
  const supabase = await createUserClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === 'sent') patch.sent_at = now;
  if (status === 'paid') patch.paid_at = now;
  const { error } = await supabase.from('invoices').update(patch).eq('id', id);
  if (error) throw new Error('Could not update the status.');
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = await createUserClient();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw new Error('Could not delete the invoice.');
}

export async function recordPayment(invoiceId: string, payment: PaymentInput): Promise<void> {
  const supabase = await createUserClient();
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  const { error } = await supabase.from('invoice_payments').insert({
    invoice_id: invoiceId, amount: round2(payment.amount), payment_date: payment.payment_date, mode: payment.mode,
    reference_number: payment.reference_number || null, notes: payment.notes || null,
  });
  if (error) throw new Error('Could not record the payment.');
  const paid = round2(invoice.payments.reduce((sum, p) => sum + p.amount, 0) + payment.amount);
  const balance = Math.max(round2(invoice.total - paid), 0);
  const { error: updateError } = await supabase.from('invoices').update({
    amount_paid: paid,
    balance_due: balance,
    ...(balance <= 0 ? { status: 'paid', paid_at: invoice.paid_at ?? new Date().toISOString() } : {}),
  }).eq('id', invoiceId);
  if (updateError) throw new Error('Payment saved, but the invoice balance could not be updated.');
}

/** Starting values for a new invoice, optionally pre-filled from a consultation booking. */
export async function newInvoiceDefaults(bookingId?: string) {
  const settings = await getSettings();
  const today = businessToday();
  const base = {
    bill_to_name: '', bill_to_email: '', bill_to_phone: '', bill_to_address: '', booking_id: null as string | null,
    status: 'draft' as InvoiceStatus, currency: settings.invoice_currency, invoice_date: today, due_date: addDays(today, settings.invoice_due_days),
    terms: settings.invoice_default_terms, notes: settings.invoice_notes || '',
    line_items: [{ item_name: '', description: '', quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 }],
  };
  if (!bookingId) return base;
  const supabase = await createUserClient();
  const { data: booking } = await supabase.from('bookings').select('id, name, email, phone, service, preferred_date, preferred_time, timezone').eq('id', bookingId).maybeSingle();
  if (!booking) return base;
  return {
    ...base,
    bill_to_name: booking.name, bill_to_email: booking.email, bill_to_phone: booking.phone || '', booking_id: booking.id,
    line_items: [{ item_name: booking.service, description: `Booked for ${booking.preferred_date} at ${String(booking.preferred_time).slice(0, 5)} (${booking.timezone})`, quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 }],
  };
}

/** Summary cards for the list page; cancelled invoices are ignored. */
export function invoiceSummary(invoices: Invoice[], today: string) {
  const open = invoices.filter((i) => i.status !== 'cancelled');
  const owing = open.filter((i) => i.balance_due > 0 && i.status !== 'draft');
  const in30 = addDays(today, 30);
  const paidDays = open.filter((i) => i.status === 'paid' && i.paid_at).map((i) =>
    Math.max(0, Math.round((Date.parse(i.paid_at as string) - Date.parse(`${i.invoice_date}T00:00:00Z`)) / 86400000)));
  return {
    outstanding: round2(owing.reduce((s, i) => s + i.balance_due, 0)),
    dueToday: round2(owing.filter((i) => i.due_date === today).reduce((s, i) => s + i.balance_due, 0)),
    dueIn30: round2(owing.filter((i) => i.due_date > today && i.due_date <= in30).reduce((s, i) => s + i.balance_due, 0)),
    overdue: round2(owing.filter((i) => i.due_date < today).reduce((s, i) => s + i.balance_due, 0)),
    avgDaysToPay: paidDays.length ? Math.round(paidDays.reduce((a, b) => a + b, 0) / paidDays.length) : null,
  };
}
