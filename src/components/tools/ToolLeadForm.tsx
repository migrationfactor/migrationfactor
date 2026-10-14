'use client';
import { useRef, useState } from 'react';
import type { ToolResult } from '@/features/immigration-tools/calculators';
import { validateToolLead } from '@/lib/leads/validation';

/** Plain-text summary of a tool result, stored with the lead for the team's follow-up. */
export function summariseResult(result: ToolResult): string {
  const lines = [result.title];
  if (result.total !== undefined) lines.push(`Total: ${result.total} ${result.unit === 'AUD' ? 'AUD' : 'points'}`);
  result.items?.forEach(item => lines.push(`${item.label}: ${item.amount}${result.unit === 'AUD' ? ' AUD' : ' points'}`));
  result.checks?.forEach(check => lines.push(`${check.label} — ${check.status}: ${check.detail}`));
  if (result.pathways?.length) lines.push(`Potential pathways: ${result.pathways.join('; ')}`);
  return lines.join('\n').slice(0, 6000);
}

export default function ToolLeadForm({ toolSlug, answers, result }: { toolSlug: string; answers: Record<string, string>; result: ToolResult }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', message: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'saved' | 'error'; message?: string }>({ kind: 'idle' });
  const form = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  function change(key: keyof typeof values, value: string | boolean) {
    setValues(previous => ({ ...previous, [key]: value }));
    setErrors(previous => { const copy = { ...previous }; delete copy[key]; return copy; });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'sending') return;
    const payload = { ...values, toolSlug, answers, resultSummary: summariseResult(result), website: (form.current?.elements.namedItem('website') as HTMLInputElement | null)?.value || '' };
    const { errors: found } = validateToolLead(payload, new Set([toolSlug]));
    setErrors(found);
    if (Object.keys(found).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus()); return; }
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/tool-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setErrors(body.errors || {}); throw new Error(body.message || 'Your request could not be saved. Please try again.'); }
      setStatus({ kind: 'saved', message: body.message });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof TypeError ? 'Connection failed. Your request was not saved. Please try again.' : (error as Error).message });
    }
    requestAnimationFrame(() => statusRef.current?.focus());
  }
  const field = (key: 'name' | 'email' | 'phone', label: string, type: string, autoComplete: string) => {
    const id = `lead-${key}`;
    return <label htmlFor={id}>{label}<input id={id} name={key} type={type} autoComplete={autoComplete} maxLength={key === 'email' ? 254 : key === 'phone' ? 40 : 100} value={values[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : undefined} onChange={e => change(key, e.target.value)} />{errors[key] && <span className="field-error" id={`${id}-error`}>{errors[key]}</span>}</label>;
  };
  if (status.kind === 'saved') return <div className="tool-lead" ref={statusRef} tabIndex={-1} role="status"><h3>Request received</h3><p>{status.message}</p></div>;
  return <form className="tool-lead" ref={form} noValidate onSubmit={submit} aria-labelledby="tool-lead-title">
    <h3 id="tool-lead-title">Want an expert to review this result?</h3>
    <p>Optional. Send your answers and result to our team and we will contact you. Your result above stays available either way.</p>
    <div className="feature-fields">
      {field('name', 'Full name', 'text', 'name')}
      {field('email', 'Email', 'email', 'email')}
      {field('phone', 'Mobile number (optional)', 'tel', 'tel')}
      <label htmlFor="lead-message">Anything else? (optional)<textarea id="lead-message" name="message" rows={2} maxLength={1500} value={values.message} aria-invalid={Boolean(errors.message)} onChange={e => change('message', e.target.value)} />{errors.message && <span className="field-error">{errors.message}</span>}</label>
    </div>
    <div className="honey" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <label className="feature-consent"><input id="lead-consent" type="checkbox" checked={values.consent} aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? 'lead-consent-error' : undefined} onChange={e => change('consent', e.target.checked)} /><span>I agree to Migration Factor storing my details, answers and result to contact me about them.</span></label>
    {errors.consent && <span className="field-error" id="lead-consent-error">{errors.consent}</span>}
    <div className="feature-actions"><button className="button" type="submit" disabled={status.kind === 'sending'} aria-busy={status.kind === 'sending'}><span>{status.kind === 'sending' ? 'Sending…' : 'Send to an expert'}</span></button></div>
    <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className={status.kind === 'error' ? 'feature-note feature-note-error' : undefined}>{status.kind === 'error' ? status.message : ''}</div>
  </form>;
}
