'use client';

import { useEffect, useRef, useState } from 'react';
import Icon, { type IconType } from '@/components/ui/Icon';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { company } from '@/content/company';

const topics: [IconType, string][] = [
  ['calendar', 'Book a consultation'],
  ['study', 'Student visa'],
  ['case', 'Skilled & PR visa'],
  ['people', 'Partner & family visa'],
  ['shield', 'Visa refusal or appeal'],
];

/** Bottom-right WhatsApp launcher that opens a short form and starts a prefilled chat. */
export default function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  function startChat(event: React.FormEvent) {
    event.preventDefault();
    const visitor = name.trim();
    if (!visitor) { setError(true); inputRef.current?.focus(); return; }
    const message = `Hello Migration Factor, my name is ${visitor}.`
      + (topic ? ` I'd like to ask about: ${topic}.` : ' I have a question about my visa options.');
    window.open(`${company.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  return (
    <div className="floating-whatsapp" ref={rootRef} data-open={open}>
      <div className="whatsapp-panel" id="whatsapp-panel" role="dialog" aria-labelledby="whatsapp-panel-title" hidden={!open}>
        <div className="whatsapp-panel-head">
          <p className="whatsapp-panel-eyebrow"><WhatsAppIcon />WhatsApp live support</p>
          <h2 id="whatsapp-panel-title">Chat directly with our team</h2>
          <p>Enter your name to start a chat with a migration consultant.</p>
          <button className="whatsapp-panel-close" type="button" aria-label="Close WhatsApp chat" onClick={() => setOpen(false)}>×</button>
        </div>
        <form className="whatsapp-panel-body" onSubmit={startChat} noValidate>
          <label className="whatsapp-field-label" htmlFor="whatsapp-name"><Icon type="people" />Your name</label>
          <input ref={inputRef} id="whatsapp-name" type="text" autoComplete="name" placeholder="e.g. Ali Khan"
            value={name} aria-invalid={error} aria-describedby={error ? 'whatsapp-name-error' : undefined}
            onChange={event => { setName(event.target.value); if (error) setError(false); }} />
          {error && <p className="whatsapp-error" id="whatsapp-name-error">Please enter your name to continue.</p>}
          <p className="whatsapp-topics-title" id="whatsapp-topics-title">Topic (optional)</p>
          <div className="whatsapp-topics" role="group" aria-labelledby="whatsapp-topics-title">
            {topics.map(([icon, label]) => (
              <button key={label} type="button" aria-pressed={topic === label}
                onClick={() => setTopic(topic === label ? '' : label)}>
                <Icon type={icon} />{label}
              </button>
            ))}
          </div>
          <button className="whatsapp-start" type="submit"><WhatsAppIcon />Start chat on WhatsApp</button>
        </form>
      </div>
      <button ref={toggleRef} className="floating-whatsapp-button" type="button" aria-expanded={open} aria-controls="whatsapp-panel"
        aria-label={open ? 'Close WhatsApp chat' : 'Chat with us on WhatsApp'} onClick={() => setOpen(value => !value)}>
        <WhatsAppIcon />
      </button>
    </div>
  );
}
