'use client';

import { useRef, useState } from 'react';
import { company } from '@/content/company';
import { services } from '@/content/services';
import { consultation, emptyConsultation, pakistanDate, preferenceTimes, validateConsultation, type ConsultationDetails } from '@/features/consultation-booking/model';

export default function ConsultationForm() {
  const [value, setValue] = useState<ConsultationDetails>(emptyConsultation);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  function change(key: keyof ConsultationDetails, next: string | boolean) {
    setValue(previous => ({ ...previous, [key]: next }));
    setErrors(previous => { const copy = { ...previous }; delete copy[key]; return copy; });
  }
  function go(next: number) { setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
  function advance() {
    const all = validateConsultation(value);
    const relevant = Object.fromEntries(Object.entries(all).filter(([key]) => step === 0 ? ['format', 'date', 'time'].includes(key) : true));
    setErrors(relevant);
    if (!Object.keys(relevant).length) go(step + 1);
    else requestAnimationFrame(() => document.querySelector<HTMLElement>('.feature-workspace [aria-invalid="true"]')?.focus());
  }
  const error = (key: string) => errors[key] ? <span className="field-error" id={`error-${key}`}>{errors[key]}</span> : null;
  const props = (key: keyof ConsultationDetails) => ({ id: key, name: key, 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `error-${key}` : undefined });
  return <div className="feature-workspace">
    <aside className="feature-note"><strong>Free · 30 minutes · Phone or video</strong><p>{consultation.hours} ({consultation.timezone}). Choose your preferred time below.</p><p>Online booking is not live yet. This form lets you prepare and review your details. Times are preferences, not confirmed availability; nothing is sent or reserved.</p></aside>
    <ol className="feature-steps" aria-label="Consultation steps">{['Your preference', 'Your details', 'Review'].map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}>{i + 1}. {label}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1}>{['Plan your free consultation', 'Tell us how we can help', 'Review your consultation preference'][step]}</h2>
    {step < 2 ? <form noValidate onSubmit={event => { event.preventDefault(); advance(); }}>
      {step === 0 ? <div className="feature-fields">
        <label htmlFor="format">Consultation format<select {...props('format')} value={value.format} onChange={e => change('format', e.target.value)}><option value="">Select a format</option><option value="phone">Phone</option><option value="video">Video</option></select>{error('format')}</label>
        <label htmlFor="date">Preferred date<input {...props('date')} type="date" min={pakistanDate()} value={value.date} onChange={e => change('date', e.target.value)} />{error('date')}</label>
        <label htmlFor="time">Preferred time · Pakistan (UTC+5)<select {...props('time')} value={value.time} onChange={e => change('time', e.target.value)}><option value="">Select a time preference</option>{preferenceTimes.map(time => <option key={time} value={time}>{time} PKT</option>)}</select>{error('time')}</label>
        <div className="feature-note">Appointments last 30 minutes. The last start time is 8:30pm. Our team will confirm availability when booking becomes available.</div>
      </div> : <>
        <div className="feature-fields">{([['name', 'Full name', 'text', 'name'], ['email', 'Email', 'email', 'email'], ['phone', 'Phone with country code', 'tel', 'tel'], ['country', 'Country of residence', 'text', 'country-name']] as const).map(([key, label, type, autocomplete]) => <label key={key} htmlFor={key}>{label}<input {...props(key)} type={type} autoComplete={autocomplete} maxLength={key === 'email' ? 254 : 100} value={value[key]} onChange={e => change(key, e.target.value)} />{error(key)}</label>)}
          <label htmlFor="category">Visa or immigration category<select {...props('category')} value={value.category} onChange={e => change('category', e.target.value)}><option value="">Select a category</option>{[...services.map(s => s.name), 'Not sure yet'].map(name => <option key={name}>{name}</option>)}</select>{error('category')}</label>
          <label className="field-wide" htmlFor="message">Brief enquiry<textarea {...props('message')} rows={4} maxLength={1500} value={value.message} onChange={e => change('message', e.target.value)} />{error('message')}<small>Please do not include passport numbers, identity documents or medical records.</small></label>
        </div>
        <label className="feature-consent"><input {...props('consent')} type="checkbox" checked={value.consent} onChange={e => change('consent', e.target.checked)} /><span>I understand that these details are held only in this page’s memory to prepare my consultation preference. They are not submitted or saved. I can use “Clear my details” on the review step to erase them. No appointment is booked.</span></label>{error('consent')}
      </>}
      <div className="feature-actions">{step > 0 && <button className="feature-secondary" type="button" onClick={() => go(step - 1)}>Back</button>}<button className="button" type="submit"><span>{step === 0 ? 'Continue to details' : 'Review preference'}</span></button></div>
    </form> : <>
      <dl className="feature-summary">{[['Consultation', 'Free · 30 minutes'], ['Format', value.format === 'phone' ? 'Phone' : 'Video'], ['Preferred appointment', `${value.date} at ${value.time} · Asia/Karachi (UTC+5)`], ['Name', value.name], ['Email', value.email], ['Phone', value.phone], ['Residence', value.country], ['Category', value.category], ['Enquiry', value.message]].map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>
      <div className="feature-note" role="status"><strong>Your preference is ready to review. It has not been submitted.</strong><p>No booking reference or confirmation can be issued yet. To arrange a consultation now, contact our team directly.</p><a href={`mailto:${company.email}`}>{company.email}</a> · <a href={`tel:${company.tel}`}>{company.phone}</a></div>
      <div className="feature-actions"><button className="feature-secondary" onClick={() => go(1)}>Edit details</button><button className="feature-secondary" onClick={() => go(0)}>Edit date or format</button><button className="feature-secondary" onClick={() => { setValue(emptyConsultation); setErrors({}); go(0); }}>Clear my details</button></div>
    </>}
  </div>;
}
