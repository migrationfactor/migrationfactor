import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { company } from '@/content/company';
import type { Currency } from './totals';

export interface AppSettings {
  business_name: string;
  tagline: string | null;
  registration_number: string | null;
  office_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  logo_url: string | null;
  invoice_prefix: string;
  invoice_default_terms: string;
  invoice_due_days: number;
  invoice_notes: string | null;
  invoice_currency: Currency;
}

/** Used if the settings row cannot be read, so invoices and PDFs never fail on missing settings. */
export const FALLBACK_SETTINGS: AppSettings = {
  business_name: company.name,
  tagline: 'Migration & Visa Consultancy',
  registration_number: null,
  office_address: company.offices[0],
  contact_phone: company.phone,
  contact_email: company.email,
  website_url: 'https://migrationfactor.com',
  logo_url: null,
  invoice_prefix: 'INV-',
  invoice_default_terms: 'Due on Receipt',
  invoice_due_days: 0,
  invoice_notes: null,
  invoice_currency: 'PKR',
};

export async function getSettings(): Promise<AppSettings> {
  try {
    // Business details are not secret, and public pages (e.g. signing) need them too; read on the server only.
    const supabase = createServiceClient();
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (!data) return FALLBACK_SETTINGS;
    return { ...FALLBACK_SETTINGS, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)) } as AppSettings;
  } catch {
    return FALLBACK_SETTINGS;
  }
}
