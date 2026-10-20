'use server';

import { revalidatePath } from 'next/cache';
import { createUserClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin/auth';
import {
  createCatalogItem, createInvoice, deleteCatalogItem, deleteInvoice, getInvoiceById, recordPayment,
  updateCatalogItem, updateInvoice, updateStatus,
} from '@/lib/invoices/service';
import { sendInvoiceEmail } from '@/lib/invoices/email';
import { isUuid, validateInvoice, validatePayment } from '@/lib/invoices/validation';
import { currencies, invoiceStatuses, type InvoiceStatus } from '@/lib/invoices/totals';

export interface InvoiceActionResult {
  ok: boolean;
  id?: string;
  message: string;
  errors?: Record<string, string>;
}

function refresh(id?: string) {
  revalidatePath('/admin/invoices');
  if (id) revalidatePath(`/admin/invoices/${id}`);
}

async function emailInvoice(id: string): Promise<{ sent: boolean; message: string }> {
  const invoice = await getInvoiceById(id);
  if (!invoice) return { sent: false, message: 'Invoice not found.' };
  const outcome = await sendInvoiceEmail(invoice);
  if (outcome !== 'sent') return { sent: false, message: `The email was not sent (${outcome}). Check the client email address and try again.` };
  if (invoice.status === 'draft') await updateStatus(id, 'sent');
  return { sent: true, message: `Invoice emailed to ${invoice.bill_to_email}.` };
}

/** Creates (id = null) or updates an invoice; totals are always recomputed on the server. */
export async function saveInvoice(id: string | null, payload: unknown, send = false): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (id !== null && !isUuid(id)) return { ok: false, message: 'Invalid invoice.' };
  const { data, errors } = validateInvoice(payload);
  if (!data || Object.keys(errors).length) return { ok: false, message: 'Please check the highlighted fields.', errors };
  try {
    let invoiceId = id;
    if (invoiceId) await updateInvoice(invoiceId, data);
    else invoiceId = await createInvoice(data);
    refresh(invoiceId);
    if (!send) return { ok: true, id: invoiceId, message: 'Invoice saved.' };
    const result = await emailInvoice(invoiceId);
    refresh(invoiceId);
    return { ok: true, id: invoiceId, message: result.sent ? `Invoice saved. ${result.message}` : `Invoice saved, but ${result.message.charAt(0).toLowerCase()}${result.message.slice(1)}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The invoice could not be saved.' };
  }
}

export async function sendInvoice(id: string): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: 'Invalid invoice.' };
  const result = await emailInvoice(id);
  refresh(id);
  return { ok: result.sent, id, message: result.message };
}

export async function setInvoiceStatus(id: string, status: string): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (!isUuid(id) || !(invoiceStatuses as readonly string[]).includes(status)) return { ok: false, message: 'Invalid status.' };
  try {
    await updateStatus(id, status as InvoiceStatus);
    refresh(id);
    return { ok: true, id, message: 'Status updated.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not update the status.' };
  }
}

export async function removeInvoice(id: string): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: 'Invalid invoice.' };
  try {
    await deleteInvoice(id);
    refresh();
    return { ok: true, message: 'Invoice deleted.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not delete the invoice.' };
  }
}

export async function addPayment(id: string, payload: unknown): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: 'Invalid invoice.' };
  const { data, errors } = validatePayment(payload);
  if (!data || Object.keys(errors).length) return { ok: false, message: 'Please check the payment details.', errors };
  try {
    await recordPayment(id, data);
    refresh(id);
    return { ok: true, id, message: 'Payment recorded.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not record the payment.' };
  }
}

// ---------------------------------------------------------------------------
// Settings and item catalog
// ---------------------------------------------------------------------------
const field = (formData: FormData, name: string, max: number) => String(formData.get(name) || '').trim().slice(0, max);

export async function saveSettings(_state: InvoiceActionResult | null, formData: FormData): Promise<InvoiceActionResult> {
  await requireAdmin();
  const dueDays = Number(formData.get('invoice_due_days') || 0);
  const patch: Record<string, unknown> = {};
  const scope = formData.get('scope');
  if (scope === 'business') {
    const business = field(formData, 'business_name', 160);
    if (!business) return { ok: false, message: 'Enter the business name.' };
    const email = field(formData, 'contact_email', 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid contact email.' };
    const website = field(formData, 'website_url', 200);
    if (website && !/^https?:\/\/\S+$/.test(website)) return { ok: false, message: 'The website must start with https://' };
    Object.assign(patch, {
      business_name: business, tagline: field(formData, 'tagline', 200) || null,
      registration_number: field(formData, 'registration_number', 120) || null,
      office_address: field(formData, 'office_address', 400) || null, contact_phone: field(formData, 'contact_phone', 40) || null,
      contact_email: email || null, website_url: website || null,
    });
  } else {
    if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) return { ok: false, message: 'Due days must be between 0 and 365.' };
    const currency = String(formData.get('invoice_currency') || '');
    if (!(currencies as readonly string[]).includes(currency)) return { ok: false, message: 'Choose PKR or AUD.' };
    Object.assign(patch, {
      invoice_currency: currency,
      invoice_prefix: field(formData, 'invoice_prefix', 12) || 'INV-',
      invoice_default_terms: field(formData, 'invoice_default_terms', 80) || 'Due on Receipt',
      invoice_due_days: dueDays, invoice_notes: field(formData, 'invoice_notes', 4000) || null,
    });
  }
  const supabase = await createUserClient();
  const { data, error } = await supabase.from('app_settings').update(patch).eq('id', 1).select('id');
  if (error || !data?.length) return { ok: false, message: 'Settings could not be saved.' };
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Settings saved.' };
}

function readCatalog(payload: unknown) {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const name = String(raw.name ?? '').trim().slice(0, 160);
  const description = String(raw.description ?? '').trim().slice(0, 1000);
  const rate = Number(raw.default_rate ?? 0);
  if (!name) return { error: 'Enter the item name.' } as const;
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000000) return { error: 'Enter a valid rate.' } as const;
  return { name, description, default_rate: rate, is_active: raw.is_active !== false } as const;
}

export async function saveCatalogItem(id: string | null, payload: unknown): Promise<InvoiceActionResult> {
  await requireAdmin();
  const item = readCatalog(payload);
  if ('error' in item) return { ok: false, message: item.error as string };
  try {
    if (id) {
      if (!isUuid(id)) return { ok: false, message: 'Invalid item.' };
      await updateCatalogItem(id, item);
    } else await createCatalogItem(item);
    revalidatePath('/admin/settings');
    return { ok: true, message: 'Item saved.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not save the item.' };
  }
}

export async function removeCatalogItem(id: string): Promise<InvoiceActionResult> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: 'Invalid item.' };
  try {
    await deleteCatalogItem(id);
    revalidatePath('/admin/settings');
    return { ok: true, message: 'Item deleted.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not delete the item.' };
  }
}
