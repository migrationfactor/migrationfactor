'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSignWorkflow, prepareUploads } from '@/app/admin/signature-actions';
import { expiryOptions, MAX_PDF_BYTES, reminderOptions } from '@/lib/signatures/fields';

interface Recipient { key: number; name: string; email: string; role: 'signer' | 'cc'; message: string; showMessage: boolean }
interface Props {
  mode: 'send' | 'self';
  adminEmail: string;
  documents: { id: string; name: string; created_at: string }[];
  templates: { id: string; name: string; description: string | null }[];
}

let key = 0;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameFromEmail = (email: string) => email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const blank = (): Recipient => ({ key: ++key, name: '', email: '', role: 'signer', message: '', showMessage: false });
const prettyName = (file: string) => file.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();

export default function SignSetupForm({ mode, adminEmail, documents, templates }: Props) {
  const router = useRouter();
  const self = mode === 'self';
  const [source, setSource] = useState<'upload' | 'document' | 'template'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [docId, setDocId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>(() => self ? [{ ...blank(), name: nameFromEmail(adminEmail), email: adminEmail }] : [blank()]);
  const [sequential, setSequential] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [expiryDays, setExpiryDays] = useState(15);
  const [reminderDays, setReminderDays] = useState<number | null>(5);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [step, setStep] = useState('');
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function notify(text: string, error = true) { setToast({ text, error }); window.setTimeout(() => setToast(null), 5000); }
  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = [...list];
    const rejected = incoming.filter((f) => f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name));
    const tooBig = incoming.filter((f) => f.size > MAX_PDF_BYTES);
    if (rejected.length) notify('Only PDF files can be uploaded.');
    else if (tooBig.length) notify(`${tooBig[0].name} is larger than 20 MB.`);
    const ok = incoming.filter((f) => !rejected.includes(f) && !tooBig.includes(f));
    setFiles((prev) => {
      const next = [...prev, ...ok].slice(0, 10);
      if (!name && next[0]) setName(prettyName(next[0].name));
      return next;
    });
  }
  function setRecipient(k: number, patch: Partial<Recipient>) { setRecipients((prev) => prev.map((r) => (r.key === k ? { ...r, ...patch } : r))); }
  function move(index: number, by: number) {
    setRecipients((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (source === 'upload' && !files.length) return notify('Add a PDF document.');
    if (source === 'document' && !docId) return notify('Choose a client file.');
    if (source === 'template' && !templateId) return notify('Choose a template.');
    if (!name.trim()) return notify('Enter the document name.');
    if (!recipients.some((r) => r.role === 'signer')) return notify('Add at least one recipient who needs to sign.');
    const bad = recipients.find((r) => r.name.trim().length < 2 || !emailPattern.test(r.email.trim()));
    if (bad) return notify('Every recipient needs a full name and a valid email address.');
    startTransition(async () => {
      let paths: string[] = [];
      if (source === 'upload') {
        setStep('Uploading…');
        const prepared = await prepareUploads(files.length);
        if (!prepared.ok || !prepared.targets) { setStep(''); notify(prepared.message || 'Upload could not be prepared.'); return; }
        try {
          // Files go straight to private storage through one-time signed upload URLs.
          await Promise.all(prepared.targets.map(async (target, i) => {
            const response = await fetch(target.url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: files[i] });
            if (!response.ok) throw new Error('upload');
          }));
        } catch { setStep(''); notify('The upload failed. Check your connection and try again.'); return; }
        paths = prepared.targets.map((t) => t.path);
      }
      setStep(files.length > 1 ? 'Merging and preparing…' : 'Preparing…');
      const result = await createSignWorkflow({
        source: source === 'upload' ? { kind: 'upload', paths } : { kind: source, id: source === 'document' ? docId : templateId },
        name: name.trim(), sequential, subject, message, expiryDays, reminderDays, selfSign: self, saveAsTemplate,
        recipients: recipients.map(({ name: n, email, role, message: m }) => ({ name: n.trim(), email: email.trim(), role, message: m })),
      });
      if (!result.ok || !result.documentId) { setStep(''); notify(result.message); return; }
      router.push(`/admin/pdf-editor?documentId=${result.documentId}`);
    });
  }

  return (
    <form className="sign-setup" onSubmit={submit} noValidate>
      <Link className="admin-back" href="/admin/signature-requests">← Signature requests</Link>
      <header className="admin-header"><h1>{self ? 'Self Sign Document Setup' : 'Create Sign Workflow'}</h1></header>

      <section className="admin-panel">
        <h2>1. Document</h2>
        <div className="admin-tabs" role="tablist" aria-label="Document source">
          {([['upload', 'Upload PDF'], ['document', 'Client File'], ['template', 'From Template']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={source === value} aria-current={source === value ? 'page' : undefined} className="admin-tab-button" onClick={() => setSource(value)}>{label}</button>
          ))}
        </div>
        {source === 'upload' && <>
          <div className={`sign-drop${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}>
            <strong>Drag files here or click to browse</strong>
            <span>Accepts multiple PDF files up to 20MB each. Several files are merged into one document.</span>
            <button type="button" className="admin-button admin-button-secondary" onClick={() => fileInput.current?.click()}>Browse files</button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          {files.length > 0 && <ul className="sign-file-list">{files.map((f, i) => (
            <li key={`${f.name}-${i}`}><span>{f.name}</span><small>{(f.size / 1048576).toFixed(1)} MB</small>
              <button type="button" className="admin-link-action danger" aria-label={`Remove ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>Remove</button></li>
          ))}</ul>}
          {!self && <label className="admin-check"><input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />Also save this PDF as a reusable template</label>}
        </>}
        {source === 'document' && (documents.length
          ? <label>Client file<select value={docId} onChange={(e) => { setDocId(e.target.value); const d = documents.find((x) => x.id === e.target.value); if (d && !name) setName(d.name); }}>
              <option value="">Choose a signed document</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          : <p className="admin-empty">No completed client files yet.</p>)}
        {source === 'template' && (templates.length
          ? <label>Template<select value={templateId} onChange={(e) => { setTemplateId(e.target.value); const t = templates.find((x) => x.id === e.target.value); if (t && !name) setName(t.name); }}>
              <option value="">Choose a template</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          : <p className="admin-empty">No templates yet. Upload a PDF and tick “Also save this PDF as a reusable template”.</p>)}
        <label className="sign-name">Document Name (Sender-Facing) *<input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} required /></label>
      </section>

      <section className="admin-panel">
        <div className="sign-section-head">
          <h2>2. Recipients</h2>
          {!self && <label className="sign-switch"><input type="checkbox" checked={sequential} onChange={(e) => setSequential(e.target.checked)} /><span>Send in order</span></label>}
        </div>
        <ol className="sign-recipients">{recipients.map((r, i) => (
          <li key={r.key}>
            {sequential && <span className="sign-order" aria-label={`Signing order ${i + 1}`}>{i + 1}</span>}
            <div className="sign-recipient-fields">
              <label>Full Name<input value={r.name} maxLength={160} onChange={(e) => setRecipient(r.key, { name: e.target.value })} /></label>
              <label>Email Address<input type="email" value={r.email} maxLength={254} readOnly={self} onChange={(e) => setRecipient(r.key, { email: e.target.value })} /></label>
              <label>Action / Role<select value={r.role} disabled={self} onChange={(e) => setRecipient(r.key, { role: e.target.value as Recipient['role'] })}>
                <option value="signer">Needs to sign</option><option value="cc">Receives copy</option></select></label>
            </div>
            {!self && <div className="sign-recipient-tools">
              {sequential && <><button type="button" className="admin-link-action" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="admin-link-action" aria-label="Move down" disabled={i === recipients.length - 1} onClick={() => move(i, 1)}>↓</button></>}
              <button type="button" className="admin-link-action" aria-expanded={r.showMessage} onClick={() => setRecipient(r.key, { showMessage: !r.showMessage })}>Private message</button>
              <button type="button" className="admin-link-action danger" disabled={recipients.length === 1} onClick={() => setRecipients((prev) => prev.filter((x) => x.key !== r.key))}>Remove</button>
            </div>}
            {r.showMessage && <label className="sign-private">Private message to this recipient (Optional)<textarea rows={2} maxLength={1000} value={r.message} onChange={(e) => setRecipient(r.key, { message: e.target.value })} /></label>}
          </li>
        ))}</ol>
        {!self && <div className="invoice-actions">
          <button type="button" className="admin-link-action" onClick={() => setRecipients((prev) => [...prev, blank()])}>+ Add Recipient</button>
          <button type="button" className="admin-link-action" disabled={recipients.some((r) => r.email.toLowerCase() === adminEmail.toLowerCase())}
            onClick={() => setRecipients((prev) => [...prev.filter((r) => r.name || r.email), { ...blank(), name: nameFromEmail(adminEmail), email: adminEmail }])}>Add Me</button>
        </div>}
      </section>

      {!self && <section className="admin-panel invoice-form-grid">
        <h2 className="span-2">3. Message</h2>
        <label className="span-2">Email Subject<input value={subject} maxLength={200} placeholder={`Please sign: ${name || 'document'}`} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="span-2">Custom Message / Invitation Note<textarea rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      </section>}

      <section className="admin-panel invoice-form-grid">
        <h2 className="span-2">{self ? '3' : '4'}. Workflow parameters</h2>
        <label>Link Expiration Period<select value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))}>
          {expiryOptions.map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
        {!self && <label>Email Reminder Interval<select value={reminderDays ?? ''} onChange={(e) => setReminderDays(e.target.value ? Number(e.target.value) : null)}>
          {reminderOptions.map(([v, label]) => <option key={label} value={v ?? ''}>{label}</option>)}</select></label>}
      </section>

      <div className="invoice-actions">
        <button type="submit" className="admin-button" disabled={pending}>{pending ? step || 'Working…' : 'Continue'}</button>
        <Link className="admin-link-action" href="/admin/signature-requests">Cancel</Link>
      </div>
      {toast && <div className={`admin-toast${toast.error ? ' error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.text}</div>}
    </form>
  );
}
