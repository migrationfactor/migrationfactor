'use client';

import { useRef, useState } from 'react';
import { company } from '@/content/company';
import PhoneWhatsApp from '@/components/shared/PhoneWhatsApp';
import { bookingCategories, consultation, emptyConsultation, pakistanDate, preferenceTimes, validateConsultation, type ConsultationDetails } from '@/features/consultation-booking/model';

type Submission = { state: 'idle' | 'sending' | 'error'; message?: string } | { state: 'saved'; reference: string };

export default function ConsultationForm() {
  const [value, setValue] = useState<ConsultationDetails>(emptyConsultation);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submission, setSubmission] = useState<Submission>({ state: 'idle' });
  const heading = useRef<HTMLHeadingElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  // One key per set of details, so a retried request cannot create a second booking.
  const requestKey = useRef('');
  function change(key: keyof ConsultationDetails, next: string | boolean) {
    requestKey.current = '';
    setValue(previous => ({ ...previous, [key]: next }));
    setErrors(previous => { const copy = { ...previous }; delete copy[key]; return copy; });
    if (submission.state === 'error') setSubmission({ state: 'idle' });
  }
  function go(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  function advance() {
    const all = validateConsultation(value);
    const relevant = Object.fromEntries(Object.entries(all).filter(([key]) => step === 0 ? ['format', 'date', 'time'].includes(key) : true));
    setErrors(relevant);
    if (!Object.keys(relevant).length) go(step + 1);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('.feature-workspace [aria-invalid="true"]')?.focus());
  }
  async function submit() {
    if (submission.state === 'sending') return;
    const all = validateConsultation(value);
    if (Object.keys(all).length) {
      setErrors(all);
      go(['format', 'date', 'time'].some(key => all[key]) ? 0 : 1);
      return;
    }
    requestKey.current ||= crypto.randomUUID();
    setSubmission({ state: 'sending' });
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...value, website: honeypot.current?.value || '', idempotencyKey: requestKey.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.reference) {
        const fieldErrors: Record<string, string> = result.errors || {};
        const { form: formError, ...rest } = fieldErrors;
        if (Object.keys(rest).length) {
          setErrors(rest);
          setSubmission({ state: 'idle' });
          go(['format', 'date', 'time'].some(key => rest[key]) ? 0 : 1);
          return;
        }
        throw new Error(formError || result.message || 'Your booking request could not be saved. Please try again.');
      }
      setSubmission({ state: 'saved', reference: result.reference });
      requestAnimationFrame(() => status.current?.focus());
    } catch (error) {
      setSubmission({
        state: 'error',
        message: error instanceof TypeError
          ? 'Connection failed. Your booking request was not saved. Please try again.'
          : (error as Error).message,
      });
      requestAnimationFrame(() => status.current?.focus());
    }
  }
  function reset() { requestKey.current = ''; setValue(emptyConsultation); setErrors({}); setSubmission({ state: 'idle' }); go(0); }
  const error = (key: string) => errors[key] ? <span className="field-error" id={`error-${key}`}>{errors[key]}</span> : null;
  const props = (key: keyof ConsultationDetails) => ({ id: key, name: key, 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `error-${key}` : undefined });
  const saved = submission.state === 'saved';
  const sending = submission.state === 'sending';
  return <div className="feature-workspace">
    <aside className="feature-note"><strong>Free · 30 minutes · Phone or video</strong><p>{consultation.hours} ({consultation.timezone}). Choose your preferred time below.</p><p>Your request is saved securely and our team will contact you to confirm. The time you choose is a preference until we confirm it with you.</p></aside>
    <ol className="feature-steps" aria-label="Consultation steps">{['Your preference', 'Your details', 'Review & send'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>{i + 1}. {label}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1}>{saved ? 'Your booking request has been received' : ['Plan your free consultation', 'Tell us how we can help', 'Review and send your request'][step]}</h2>
    {step < 2 ? <form noValidate onSubmit={event => { event.preventDefault(); advance(); }}>
      {step === 0 ? <div className="feature-fields">
        <label htmlFor="format">Consultation format<select {...props('format')} value={value.format} onChange={e => change('format', e.target.value)}><option value="">Select a format</option><option value="phone">Phone</option><option value="video">Video</option></select>{error('format')}</label>
        <label htmlFor="date">Preferred date<input {...props('date')} type="date" min={pakistanDate()} value={value.date} onChange={e => change('date', e.target.value)} />{error('date')}</label>
        <label htmlFor="time">Preferred time · Pakistan (UTC+5)<select {...props('time')} value={value.time} onChange={e => change('time', e.target.value)}><option value="">Select a time preference</option>{preferenceTimes.map(time => <option key={time} value={time}>{time} PKT</option>)}</select>{error('time')}</label>
        <div className="feature-note">Appointments last 30 minutes. The last start time is 8:30pm. Our team confirms availability after receiving your request.</div>
      </div> : <>
        <div className="feature-fields">{([['name', 'Full name', 'text', 'name'], ['email', 'Email', 'email', 'email'], ['phone', 'Mobile number with country code', 'tel', 'tel'], ['country', 'Country of residence', 'text', 'country-name']] as const).map(([key, label, type, autocomplete]) => <label key={key} htmlFor={key}>{label}<input {...props(key)} type={type} autoComplete={autocomplete} maxLength={key === 'email' ? 254 : 100} value={value[key]} onChange={e => change(key, e.target.value)} />{error(key)}</label>)}
          <label htmlFor="category">Consultation or service type<select {...props('category')} value={value.category} onChange={e => change('category', e.target.value)}><option value="">Select a category</option>{bookingCategories.map(name => <option key={name}>{name}</option>)}</select>{error('category')}</label>
          <label className="field-wide" htmlFor="message">Brief enquiry<textarea {...props('message')} rows={4} maxLength={1500} value={value.message} onChange={e => change('message', e.target.value)} />{error('message')}<small>Please do not include passport numbers, identity documents or medical records.</small></label>
        </div>
        <div className="honey" aria-hidden="true"><label>Website<input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="feature-consent"><input {...props('consent')} type="checkbox" checked={value.consent} onChange={e => change('consent', e.target.checked)} /><span>I agree to Migration Factor storing these details to arrange my consultation. I understand this is a request and the appointment is booked only when the team confirms it with me.</span></label>{error('consent')}
      </>}
      <div className="feature-actions">{step > 0 && <button className="feature-secondary" type="button" onClick={() => go(step - 1)}>Back</button>}<button className="button" type="submit"><span>{step === 0 ? 'Continue to details' : 'Review request'}</span></button></div>
    </form> : <>
      <dl className="feature-summary">{[['Consultation', 'Free · 30 minutes'], ['Format', value.format === 'phone' ? 'Phone' : 'Video'], ['Preferred appointment', `${value.date} at ${value.time} · Asia/Karachi (UTC+5)`], ['Name', value.name], ['Email', value.email], ['Phone', value.phone], ['Residence', value.country], ['Category', value.category], ['Enquiry', value.message]].map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>
      <div className={`feature-note${submission.state === 'error' ? ' feature-note-error' : ''}`} role="status" aria-live="polite" tabIndex={-1} ref={status}>
        {saved ? <><strong>Request saved · Reference {submission.reference}</strong><p>Status: pending confirmation. Your preferred time is not yet confirmed. Our team will contact you to confirm the appointment.</p><a href={`mailto:${company.email}`}>{company.email}</a> · <PhoneWhatsApp /></>
          : submission.state === 'error' ? <><strong>Your request was not saved.</strong><p>{submission.message}</p></>
          : <><strong>Please check your details before sending.</strong><p>Your request is saved only after you select “Send booking request”.</p></>}
      </div>
      <div className="feature-actions">{saved
        ? <button className="feature-secondary" type="button" onClick={reset}>Make another request</button>
        : <><button className="button" type="button" onClick={submit} disabled={sending} aria-busy={sending}><span>{sending ? 'Sending request…' : 'Send booking request'}</span></button><button className="feature-secondary" type="button" disabled={sending} onClick={() => go(1)}>Edit details</button><button className="feature-secondary" type="button" disabled={sending} onClick={() => go(0)}>Edit date or format</button><button className="feature-secondary" type="button" disabled={sending} onClick={reset}>Clear my details</button></>}</div>
    </>}
  </div>;
}
