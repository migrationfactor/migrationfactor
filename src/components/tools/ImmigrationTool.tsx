'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { disclaimer, toolSources, verifiedOn, type ToolSlug } from '@/features/immigration-tools/catalog';
import { visibleFields, validateAnswers, type Answers } from '@/features/immigration-tools/fields';
import { calculateTool, type ToolResult } from '@/features/immigration-tools/calculators';

export default function ImmigrationTool({ slug }: { slug: ToolSlug }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  function change(key: string, value: string) { setAnswers(previous => ({ ...previous, [key]: value })); setResult(null); setErrors(previous => { const copy = { ...previous }; delete copy[key]; return copy; }); }
  function submit() {
    const next = validateAnswers(slug, answers); setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid=true]')?.focus()); return; }
    setResult(calculateTool(slug, answers)); requestAnimationFrame(() => output.current?.focus());
  }
  const currency = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
  return <div className="feature-workspace">
    <p className="feature-note">{disclaimer}</p>
    <form noValidate ref={form} onSubmit={event => { event.preventDefault(); submit(); }}>
      <div className="feature-fields">{visibleFields(slug, answers).map(field => {
        const id = `tool-${field.key}`; const help = [field.help ? `${id}-help` : '', errors[field.key] ? `${id}-error` : ''].filter(Boolean).join(' ');
        const attributes = { id, name: field.key, value: answers[field.key] ?? '', 'aria-invalid': Boolean(errors[field.key]), 'aria-describedby': help || undefined, required: true, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => change(field.key, e.target.value) };
        return <label key={field.key} htmlFor={id}>{field.label}{field.options ? <select {...attributes}><option value="">Select an answer</option>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <input {...attributes} type="number" min={field.min} max={field.max} step={field.step} inputMode={field.step === 1 ? 'numeric' : 'decimal'} />}{field.help && <small id={`${id}-help`}>{field.help}</small>}{errors[field.key] && <span className="field-error" id={`${id}-error`}>{errors[field.key]}</span>}</label>;
      })}</div>
      <div className="feature-actions"><button className="button" type="submit"><span>{slug.includes('cost') || slug === 'pr-calculator' ? 'Calculate estimate' : 'Review my answers'}</span></button><button className="feature-secondary" type="button" onClick={() => { setAnswers({}); setErrors({}); setResult(null); form.current?.querySelector<HTMLElement>('select,input')?.focus(); }}>Reset answers</button></div>
    </form>
    {result && <div className="tool-result" ref={output} tabIndex={-1} role="region" aria-label="Your result" aria-live="polite">
      <h2>{result.title}</h2>{result.total !== undefined && <p className="tool-total">{result.unit === 'AUD' ? `${currency(result.total)} AUD` : `${result.total} points`}</p>}
      {result.items && <dl className="feature-summary">{result.items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{result.unit === 'AUD' ? currency(item.amount) : `${item.amount} points`}</dd></div>)}</dl>}
      {result.pathways && <><h3>Potential pathways</h3><ul>{result.pathways.map(path => <li key={path}>{path}</li>)}</ul></>}
      {result.checks && <><h3>What your answers indicate</h3><dl className="feature-summary">{result.checks.map(item => <div key={item.label}><dt>{item.label}<span className="tool-status">{item.status}</span></dt><dd>{item.detail}</dd></div>)}</dl></>}
      <ul>{result.notes.map(note => <li key={note}>{note}</li>)}</ul><p>You can edit any answer above and calculate again. Results are cleared when answers change.</p>
      <Link href="/consultation">Plan a free consultation</Link>
      {slug === 'sponsorship-cost-estimator' && <p><Link href="/tools/applicant-cost-calculator">Calculate applicant visa charges separately</Link></p>}
      {slug === 'applicant-cost-calculator' && <p><Link href="/tools/sponsorship-cost-estimator">Calculate employer sponsorship charges separately</Link></p>}
    </div>}
    <section className="tool-sources" aria-labelledby="tool-sources-title"><h2 id="tool-sources-title">Official sources for this tool</h2><p>Reference snapshot checked {verifiedOn}.</p><ul>{toolSources[slug].map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{label} (opens a new tab)</a></li>)}</ul><p>Rules and charges can change. Confirm the requirements at application time. This page does not collect or transmit your answers.</p><Link href="/tools">Explore all migration tools</Link></section>
  </div>;
}
