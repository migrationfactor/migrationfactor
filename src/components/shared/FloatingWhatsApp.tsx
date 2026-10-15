'use client';

import { useEffect, useRef, useState } from 'react';
import Icon, { type IconType } from '@/components/ui/Icon';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { company } from '@/content/company';
import { validateCommunication } from '@/lib/leads/communication';

const topics: [IconType, string][] = [
  ['calendar', 'Book a consultation'], ['study', 'Student visa'], ['case', 'Skilled & PR visa'],
  ['people', 'Partner & family visa'], ['shield', 'Visa refusal or appeal'],
];

/** Bottom-right WhatsApp launcher: saves the visitor's name and number, then opens a prefilled chat. */
export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [topic, setTopic] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [chatLink, setChatLink] = useState('');
  const [starting, setStarting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const honeyRef = useRef<HTMLInputElement>(null);
  const visitorId = useRef('');

  // Every public link to the business WhatsApp opens the same enquiry panel.
  useEffect(() => {
    const launch = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || rootRef.current?.contains(anchor)) return;
      const destination = new URL(anchor.href, location.href);
      const expected = new URL(company.whatsapp);
      if (destination.origin !== expected.origin || destination.pathname.replace(/\/$/, '') !== expected.pathname.replace(/\/$/, '')) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('click', launch, true);
    return () => document.removeEventListener('click', launch, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); } };
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);

  async function startChat(event: React.FormEvent) {
    event.preventDefault();
    if (starting) return;
    visitorId.current ||= crypto.randomUUID();
    const payload = { channel: 'whatsapp', visitorId: visitorId.current, name, phone, email: '', topic, message: '', consent: true, website: honeyRef.current?.value || '' };
    const checked = validateCommunication(payload);
    setErrors(checked.errors);
    if (checked.errors.name) { nameRef.current?.focus(); return; }
    if (checked.errors.phone) { phoneRef.current?.focus(); return; }
    if (Object.keys(checked.errors).length) return;

    // Open the tab during the click so browsers do not block it, then point it at WhatsApp once saved.
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setStarting(true);
    setChatLink('');
    try {
      const response = await fetch('/api/communication-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new Error(result.errors?.phone || result.errors?.name || result.message || 'Your details could not be saved. Please try again.');
      const message = `Hello Migration Factor, my name is ${name.trim()}.`
        + (topic ? ` I would like to ask about: ${topic}.` : ' I have a question about my visa options.')
        + ` Reference: ${result.reference}.`;
      const url = `${company.whatsapp}?text=${encodeURIComponent(message)}`;
      if (popup && !popup.closed) { popup.location.replace(url); setOpen(false); } else setChatLink(url);
    } catch (cause) {
      popup?.close();
      setErrors({ form: cause instanceof TypeError ? 'Connection failed. Please try again.' : (cause as Error).message });
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="floating-whatsapp" ref={rootRef} data-open={open}>
      <div className="whatsapp-panel" id="whatsapp-panel" role="dialog" aria-labelledby="whatsapp-panel-title" hidden={!open}>
        <div className="whatsapp-panel-head">
          <p className="whatsapp-panel-eyebrow"><WhatsAppIcon />WhatsApp live support</p>
          <h2 id="whatsapp-panel-title">Chat directly with our team</h2>
          <p>Enter your name and number to start a chat with a migration consultant.</p>
          <button className="whatsapp-panel-close" type="button" aria-label="Close WhatsApp chat" onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="whatsapp-panel-body" onSubmit={startChat} noValidate>
          <label className="whatsapp-field-label" htmlFor="whatsapp-name"><Icon type="people" />Your name</label>
          <input ref={nameRef} id="whatsapp-name" type="text" autoComplete="name" maxLength={100} placeholder="e.g. Ali Khan"
            value={name} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'whatsapp-name-error' : undefined}
            onChange={event => { setName(event.target.value); setErrors({}); }} />
          {errors.name && <p className="whatsapp-error" id="whatsapp-name-error">{errors.name}</p>}

          <label className="whatsapp-field-label whatsapp-field-gap" htmlFor="whatsapp-phone"><Icon type="phone" />Phone number</label>
          <input ref={phoneRef} id="whatsapp-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} placeholder="e.g. +61 4XX XXX XXX"
            value={phone} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'whatsapp-phone-error' : undefined}
            onChange={event => { setPhone(event.target.value); setErrors({}); }} />
          {errors.phone && <p className="whatsapp-error" id="whatsapp-phone-error">{errors.phone}</p>}

          <div className="honey" aria-hidden="true"><label>Website<input ref={honeyRef} name="website" tabIndex={-1} autoComplete="off" /></label></div>

          <p className="whatsapp-topics-title" id="whatsapp-topics-title">Topic (optional)</p>
          <div className="whatsapp-topics" role="group" aria-labelledby="whatsapp-topics-title">
            {topics.map(([icon, label]) => (
              <button key={label} type="button" aria-pressed={topic === label} onClick={() => setTopic(topic === label ? '' : label)}>
                <Icon type={icon} />{label}
              </button>
            ))}
          </div>

          {errors.form && <p className="whatsapp-error" role="alert">{errors.form}</p>}
          <button className="whatsapp-start" type="submit" disabled={starting}><WhatsAppIcon />{starting ? 'Saving your details…' : 'Start chat on WhatsApp'}</button>
          {chatLink && <a className="whatsapp-continue" href={chatLink} target="_blank" rel="noopener noreferrer">Details saved. Continue to WhatsApp ↗</a>}
          <p className="whatsapp-privacy">By starting a chat, your name and number are saved so our team can contact you about your enquiry. To update or remove your details, email {company.email}.</p>
        </form>
      </div>
      <button ref={toggleRef} className="floating-whatsapp-button" type="button" aria-expanded={open} aria-controls="whatsapp-panel"
        aria-label={open ? 'Close WhatsApp chat' : 'Chat with us on WhatsApp'} onClick={() => setOpen(value => !value)}>
        <WhatsAppIcon />
      </button>
    </div>
  );
}
