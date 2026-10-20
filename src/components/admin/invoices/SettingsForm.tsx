'use client';
import { useActionState } from 'react';
import { saveSettings } from '@/app/admin/invoice-actions';
import type { AppSettings } from '@/lib/invoices/settings';
import { currencies, currencyNames } from '@/lib/invoices/totals';

export default function SettingsForm({ scope, settings }: { scope: 'business' | 'invoice'; settings: AppSettings }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const input = (name: keyof AppSettings, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={name} defaultValue={String(settings[name] ?? '')} {...props} /></label>
  );
  return (
    <form action={action} className="admin-panel invoice-form-grid">
      <input type="hidden" name="scope" value={scope} />
      {scope === 'business' ? <>
        {input('business_name', 'Business name *', { required: true, maxLength: 160 })}
        {input('tagline', 'Tagline', { maxLength: 200 })}
        {input('registration_number', 'Registration line (MARN / ABN)', { maxLength: 120, placeholder: 'e.g. MARN: 1234567 | ABN: 12 345 678 901' })}
        {input('contact_phone', 'Contact phone', { maxLength: 40 })}
        {input('contact_email', 'Contact email', { type: 'email', maxLength: 254 })}
        {input('website_url', 'Website', { type: 'url', maxLength: 200, placeholder: 'https://migrationfactor.com' })}
        <label className="span-2">Office address<textarea name="office_address" rows={2} maxLength={400} defaultValue={settings.office_address ?? ''} /></label>
      </> : <>
        <label>Default currency<select name="invoice_currency" defaultValue={settings.invoice_currency}>{currencies.map((c) => <option key={c} value={c}>{currencyNames[c]}</option>)}</select></label>
        {input('invoice_prefix', 'Invoice number prefix', { maxLength: 12 })}
        {input('invoice_default_terms', 'Default terms', { maxLength: 80 })}
        {input('invoice_due_days', 'Default due days', { type: 'number', min: 0, max: 365, step: 1 })}
        <label className="span-2">Default customer notes (bank details)<textarea name="invoice_notes" rows={4} maxLength={4000} defaultValue={settings.invoice_notes ?? ''} /></label>
      </>}
      <div className="span-2 invoice-actions">
        <button type="submit" className="admin-button" disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button>
        <p role="status" aria-live="polite" className={`admin-message${state && !state.ok ? ' error' : ''}`}>{state?.message}</p>
      </div>
    </form>
  );
}
