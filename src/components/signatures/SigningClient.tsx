'use client';
import { useMemo, useRef, useState } from 'react';
import { fieldLabels, fieldPrompts, formatSignDate, isImageField, isRequired, splitName, type SignField } from '@/lib/signatures/fields';
import { PdfCanvas, usePdf, useWidth } from './pdf';
import SignatureModal, { type SignatureImages } from './SignatureModal';

interface Props {
  token: string; business: string; documentName: string; signerName: string; signerEmail: string;
  expiresInDays: number; fields: SignField[]; pdfUrl: string | null;
}
type Phase = { kind: 'ready' } | { kind: 'submitting' } | { kind: 'success' } | { kind: 'declined' } | { kind: 'error'; message: string };

const toIso = (ddmmyyyy: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

export default function SigningClient({ token, business, documentName, signerName, signerEmail, expiresInDays: days, fields, pdfUrl }: Props) {
  const { pdf, error } = usePdf(pdfUrl);
  const [stageRef, stageWidth] = useWidth<HTMLDivElement>();
  const ordered = useMemo(() => [...fields].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x), [fields]);
  const { first, last } = splitName(signerName);
  const [values, setValues] = useState<Record<string, string | boolean>>(() => Object.fromEntries(fields.map((f) => [f.id,
    f.type === 'checkbox' ? false : f.type === 'full_name' ? signerName : f.type === 'first_name' ? first : f.type === 'last_name' ? last
      : f.type === 'email' ? signerEmail : f.type === 'sign_date' ? formatSignDate(new Date()) : ''])));
  const [images, setImages] = useState<SignatureImages | null>(null);
  const [consent, setConsent] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [modal, setModal] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [callout, setCallout] = useState<string | null>(null);
  const declineDialog = useRef<HTMLDialogElement>(null);
  const needsInitial = fields.some((f) => f.type === 'initial');
  const pageWidth = Math.max(260, Math.min(stageWidth, 900) * zoom);

  const filled = (f: SignField) => {
    if (isImageField(f.type)) return Boolean(images?.signature);
    const v = values[f.id];
    return f.type === 'checkbox' ? v === true : typeof v === 'string' && v.trim() !== '';
  };
  const required = ordered.filter(isRequired);
  const done = required.filter(filled).length;
  const ready = done === required.length && consent && Boolean(images?.signature);

  function focusField(f: SignField) {
    setCallout(f.id);
    const el = document.getElementById(`field-${f.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => (el?.querySelector('input,button') as HTMLElement | null)?.focus({ preventScroll: true }), 350);
  }
  function step(direction: 1 | -1) {
    if (!required.some((f) => !filled(f))) { document.getElementById('signing-finish')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setCallout(null); return; }
    const n = required.length;
    const current = callout ? required.findIndex((f) => f.id === callout) : (direction === 1 ? -1 : 0);
    for (let k = 1; k <= n; k++) {
      const next = required[(((current + direction * k) % n) + n) % n];
      if (!filled(next)) { focusField(next); return; }
    }
  }
  async function submit() {
    if (!ready) return;
    setPhase({ kind: 'submitting' });
    const fieldValues = Object.fromEntries(fields.filter((f) => !isImageField(f.type)).map((f) => [f.id, values[f.id]]));
    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signaturePng: images?.signature, initialPng: images?.initial ?? null, fieldValues }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setPhase({ kind: 'error', message: body.message || 'Your signature could not be saved. Please try again.' }); return; }
      setPhase({ kind: 'success' });
      window.scrollTo({ top: 0 });
    } catch {
      setPhase({ kind: 'error', message: 'Connection failed. Your signature was not saved. Please try again.' });
    }
  }
  async function decline() {
    const response = await fetch(`/api/sign/${token}/decline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    declineDialog.current?.close();
    setDeclineOpen(false);
    if (response?.ok) setPhase({ kind: 'declined' });
    else setPhase({ kind: 'error', message: 'The document could not be declined. Please try again.' });
  }

  if (phase.kind === 'success' || phase.kind === 'declined') {
    return <div className="signing-shell"><div className="signing-state">
      <h1>{phase.kind === 'success' ? 'Document Signed' : 'Workflow Declined'}</h1>
      <p>{phase.kind === 'success' ? `Thank you, ${signerName}. Your signature has been recorded and a signed copy has been emailed to ${signerEmail}.` : `You declined to sign. ${business} can see this in their dashboard.`}</p>
      <p className="signing-doc-name">{documentName}</p>
    </div></div>;
  }

  return (
    <div className="signing-shell">
      <header className="signing-header">
        <div className="signing-title"><small>{business}</small><h1>{documentName}</h1><span>Pending your signature{days ? ` · link expires in ${days} day${days === 1 ? '' : 's'}` : ''}</span></div>
        <div className="signing-tools">
          <div className="sign-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.15) * 100) / 100))}>+</button>
          </div>
          {pdfUrl && <a className="sign-btn-outline" href={pdfUrl} target="_blank" rel="noopener noreferrer">Download / Print</a>}
          <button type="button" className="sign-btn-outline danger" onClick={() => { setDeclineOpen(true); declineDialog.current?.showModal(); }}>Decline</button>
        </div>
      </header>

      <section className="signing-disclosure" aria-labelledby="disclosure-title">
        <h2 id="disclosure-title">Electronic Record and Signature Disclosure</h2>
        <p>{business} will send you this document electronically. By ticking the box you agree to use electronic records and signatures, and that your electronic signature is as valid as a handwritten one. You can review the document before agreeing, and download a copy at any time with “Download / Print”.</p>
        <label className="signing-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I agree to use electronic records and signatures.</label>
      </section>

      <div className="signing-guide" role="region" aria-label="Signing progress">
        <span>{done} of {required.length} required field{required.length === 1 ? '' : 's'} completed</span>
        <div>
          {callout === null && done < required.length
            ? <button type="button" className="sign-btn" onClick={() => step(1)}>Start</button>
            : <><button type="button" className="sign-btn-outline" onClick={() => step(-1)}>Previous</button><button type="button" className="sign-btn" onClick={() => step(1)}>Next</button></>}
        </div>
      </div>

      <div className="signing-stage" ref={stageRef}>
        {error && <p className="signing-error" role="alert">{error}</p>}
        {!pdf && !error && <p className="signing-loading">Loading document…</p>}
        {pdf && stageWidth > 0 && pdf.pages.map((page, i) => {
          const n = i + 1;
          return (
            <div key={n} className="sign-page signing-page" style={{ width: pageWidth }}>
              <PdfCanvas page={page} width={pageWidth} label={`Page ${n} of ${pdf.pages.length}`} />
              {ordered.filter((f) => f.page === n).map((f) => {
                const ok = filled(f);
                const style = { left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` };
                const label = f.label || fieldLabels[f.type];
                return (
                  <div key={f.id} id={`field-${f.id}`} className={`signing-field${ok ? ' is-filled' : ''}${callout === f.id ? ' is-current' : ''}`} style={style}>
                    {isImageField(f.type) ? (
                      <button type="button" className="signing-sign-box" aria-label={`${label}${ok ? ' (signed, click to change)' : ''}`} onClick={() => { setCallout(f.id); setModal(true); }}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview, nothing to optimise */}
                        {ok && images ? <img src={f.type === 'initial' ? images.initial ?? images.signature : images.signature} alt="" /> : <span>{f.type === 'initial' ? 'Initial here' : 'Sign here'}</span>}
                      </button>
                    ) : f.type === 'checkbox' ? (
                      <input type="checkbox" aria-label={label} checked={values[f.id] === true} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.checked }))} onFocus={() => setCallout(f.id)} />
                    ) : f.type === 'sign_date' ? (
                      <input type="date" aria-label={label} value={toIso(String(values[f.id] || ''))} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value ? formatSignDate(e.target.value) : '' }))} onFocus={() => setCallout(f.id)} />
                    ) : (
                      <input type={f.type === 'email' ? 'email' : 'text'} aria-label={label} placeholder={label} maxLength={f.type === 'email' ? 254 : 200}
                        value={String(values[f.id] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} onFocus={() => setCallout(f.id)} />
                    )}
                    {callout === f.id && !ok && <span className="signing-callout" aria-hidden="true">{fieldPrompts[f.type]}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="signing-finish" id="signing-finish">
        {phase.kind === 'error' && <p className="signing-error" role="alert">{phase.message}</p>}
        {!consent && <p>Accept the disclosure above to finish.</p>}
        {!fields.some((f) => isImageField(f.type)) && <button type="button" className="sign-btn-outline" onClick={() => setModal(true)}>{images ? 'Change signature' : 'Add signature'}</button>}
        <button type="button" className="sign-btn sign-btn-large" disabled={!ready || phase.kind === 'submitting'} onClick={submit}>
          {phase.kind === 'submitting' ? 'Submitting…' : 'Finish'}
        </button>
        {phase.kind === 'submitting' && <p role="status">Please do not close this window.</p>}
      </div>

      <SignatureModal open={modal} defaultName={signerName} needsInitial={needsInitial} onClose={() => setModal(false)}
        onApply={(img) => { setImages(img); setModal(false); }} />

      <dialog ref={declineDialog} className="sig-modal sig-modal-small" aria-labelledby="decline-title" onClose={() => setDeclineOpen(false)}>
        {declineOpen && <>
          <h2 id="decline-title">Decline to sign?</h2>
          <p>{business} will see that you declined “{documentName}”. You will not be able to sign with this link afterwards.</p>
          <div className="sig-actions">
            <button type="button" className="sign-btn danger" onClick={decline}>Decline</button>
            <button type="button" className="sig-link" onClick={() => declineDialog.current?.close()}>Cancel</button>
          </div>
        </>}
      </dialog>
    </div>
  );
}
