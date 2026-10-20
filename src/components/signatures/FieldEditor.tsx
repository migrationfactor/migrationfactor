'use client';
import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveLayout, sendForSignature } from '@/app/admin/signature-actions';
import { defaultSizes, fieldLabels, fieldTypes, isImageField, isRequired, type FieldType, type SignField } from '@/lib/signatures/fields';
import { PdfCanvas, signerColours, usePdf, useWidth } from './pdf';

interface Signer { id: string; name: string; email: string; status: string; fields: SignField[] }
interface Props { documentId: string; documentName: string; pdfUrl: string | null; signers: Signer[]; selfSign: boolean }
type Drag = { kind: 'move' | 'resize'; signer: string; id: string; page: HTMLElement; startX: number; startY: number; orig: SignField };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
let counter = 0;
const newId = () => `f${Date.now().toString(36)}${(++counter).toString(36)}`;

export default function FieldEditor({ documentId, documentName, pdfUrl, signers, selfSign }: Props) {
  const router = useRouter();
  const { pdf, error } = usePdf(pdfUrl);
  const [stageRef, stageWidth] = useWidth<HTMLDivElement>();
  const editable = signers.every((s) => s.status === 'draft');
  const [layout, setLayout] = useState<Record<string, SignField[]>>(() => Object.fromEntries(signers.map((s) => [s.id, s.fields])));
  const [active, setActive] = useState(signers[0]?.id ?? '');
  const [selected, setSelected] = useState<{ signer: string; id: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const drag = useRef<Drag | null>(null);
  const colour = useMemo(() => Object.fromEntries(signers.map((s, i) => [s.id, signerColours[i % signerColours.length]])), [signers]);
  const pageWidth = Math.max(240, Math.min(stageWidth - 8, 820) * zoom);

  const selectedField = selected ? layout[selected.signer]?.find((f) => f.id === selected.id) ?? null : null;
  function notify(text: string, isError = false) { setToast({ text, error: isError }); window.setTimeout(() => setToast(null), 4500); }
  function update(signer: string, id: string, patch: Partial<SignField>) {
    setLayout((prev) => ({ ...prev, [signer]: prev[signer].map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }
  function remove(signer: string, id: string) {
    setLayout((prev) => ({ ...prev, [signer]: prev[signer].filter((f) => f.id !== id) }));
    setSelected(null);
  }
  function addField(type: FieldType, page: number, x?: number, y?: number) {
    if (!editable || !active) return;
    const [w, h] = defaultSizes[type];
    const field: SignField = {
      id: newId(), type, page,
      x: round2(clamp((x ?? 50) - w / 2, 0, 100 - w)), y: round2(clamp((y ?? 45) - h / 2, 0, 100 - h)), w, h,
      required: type !== 'checkbox',
    };
    setLayout((prev) => ({ ...prev, [active]: [...(prev[active] ?? []), field] }));
    setSelected({ signer: active, id: field.id });
  }
  function onDrop(event: React.DragEvent<HTMLDivElement>, page: number) {
    event.preventDefault();
    const type = event.dataTransfer.getData('text/x-sign-field') as FieldType;
    if (!(fieldTypes as readonly string[]).includes(type)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    addField(type, page, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  }
  function startDrag(event: React.PointerEvent, kind: Drag['kind'], signer: string, field: SignField) {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const page = (event.currentTarget as HTMLElement).closest<HTMLElement>('.sign-page');
    if (!page) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { kind, signer, id: field.id, page, startX: event.clientX, startY: event.clientY, orig: field };
    setSelected({ signer, id: field.id });
  }
  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const rect = d.page.getBoundingClientRect();
    const dx = ((event.clientX - d.startX) / rect.width) * 100;
    const dy = ((event.clientY - d.startY) / rect.height) * 100;
    if (d.kind === 'move') {
      update(d.signer, d.id, { x: round2(clamp(d.orig.x + dx, 0, 100 - d.orig.w)), y: round2(clamp(d.orig.y + dy, 0, 100 - d.orig.h)) });
    } else {
      update(d.signer, d.id, { w: round2(clamp(d.orig.w + dx, 2, 100 - d.orig.x)), h: round2(clamp(d.orig.h + dy, 1, 100 - d.orig.y)) });
    }
  }
  function endDrag() { drag.current = null; }
  function moveToSigner(from: string, id: string, to: string) {
    const field = layout[from].find((f) => f.id === id);
    if (!field || from === to) return;
    setLayout((prev) => ({ ...prev, [from]: prev[from].filter((f) => f.id !== id), [to]: [...prev[to], field] }));
    setSelected({ signer: to, id });
  }

  const payload = () => signers.map((s) => ({ id: s.id, fields: layout[s.id].map((f) => ({ ...f, x: round2(f.x), y: round2(f.y), w: round2(f.w), h: round2(f.h) })) }));
  function save() {
    startTransition(async () => {
      const result = await saveLayout(documentId, payload());
      notify(result.message, !result.ok);
    });
  }
  function send() {
    const missing = signers.find((s) => !layout[s.id].some((f) => isImageField(f.type)));
    if (missing) { notify(`Add a Signature or Initial field for ${missing.name}.`, true); setActive(missing.id); return; }
    startTransition(async () => {
      const result = await sendForSignature(documentId, payload());
      if (!result.ok) { notify(result.message, true); return; }
      if (result.selfSignToken) { router.push(`/sign/${result.selfSignToken}`); return; }
      notify(result.message);
      router.push('/admin/signature-requests?sent=1');
    });
  }
  function goToPage(n: number) {
    setCurrentPage(n);
    document.getElementById(`sign-page-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="sign-editor" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <header className="sign-editor-bar">
        <div>
          <Link className="admin-back" href="/admin/signature-requests">← Signature requests</Link>
          <h1>{documentName}</h1>
        </div>
        <div className="sign-signers" role="radiogroup" aria-label="Signer for new fields">
          {signers.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={active === s.id} className="sign-signer-chip" style={{ '--signer': colour[s.id] } as React.CSSProperties} onClick={() => setActive(s.id)}>
              <span aria-hidden="true" />{s.name}<small>{layout[s.id].length} field{layout[s.id].length === 1 ? '' : 's'}</small>
            </button>
          ))}
        </div>
        <div className="sign-editor-actions">
          <div className="sign-zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.5, round2(z - 0.15)))} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, round2(z + 0.15)))} aria-label="Zoom in">+</button>
          </div>
          {editable && <button type="button" className="admin-button admin-button-secondary" disabled={pending} onClick={save}>Save draft</button>}
          {editable && <button type="button" className="admin-button" disabled={pending} onClick={send}>{pending ? 'Working…' : selfSign ? 'Continue to sign' : 'Send'}</button>}
        </div>
      </header>
      {!editable && <p className="admin-hint sign-locked">This document has already been sent, so its layout is locked.</p>}

      <div className="sign-editor-body">
        <aside className="sign-palette" aria-label="Fields">
          <h2>Fields</h2>
          <p>Drag onto the page, or click to add to page {currentPage}.</p>
          {fieldTypes.map((type) => (
            <button key={type} type="button" draggable={editable} disabled={!editable} className="sign-palette-item"
              style={{ '--signer': colour[active] } as React.CSSProperties}
              onDragStart={(e) => { e.dataTransfer.setData('text/x-sign-field', type); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => addField(type, currentPage)}>
              {fieldLabels[type]}
            </button>
          ))}
          {pdf && <>
            <h2>Pages</h2>
            <div className="sign-page-nav">{pdf.pages.map((_, i) => (
              <button key={i} type="button" aria-current={currentPage === i + 1 ? 'page' : undefined} onClick={() => goToPage(i + 1)}>{i + 1}</button>
            ))}</div>
          </>}
        </aside>

        <div className="sign-stage" ref={stageRef}>
          {error && <p className="admin-empty" role="alert">{error}</p>}
          {!pdf && !error && <p className="admin-empty">Loading document…</p>}
          {pdf && stageWidth > 0 && pdf.pages.map((page, i) => {
            const n = i + 1;
            return (
              <div key={n} id={`sign-page-${n}`} className="sign-page" style={{ width: pageWidth }}
                onDragOver={(e) => { if (editable) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
                onDrop={(e) => onDrop(e, n)} onPointerDown={() => { setCurrentPage(n); setSelected(null); }}>
                <PdfCanvas page={page} width={pageWidth} label={`Page ${n} of ${pdf.pages.length}`} />
                {signers.flatMap((s) => layout[s.id].filter((f) => f.page === n).map((f) => {
                  const isSelected = selected?.id === f.id;
                  return (
                    <div key={f.id} className={`sign-field${isSelected ? ' is-selected' : ''}`} role="button" tabIndex={0}
                      aria-label={`${fieldLabels[f.type]} for ${s.name}`}
                      style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`, '--signer': colour[s.id] } as React.CSSProperties}
                      onPointerDown={(e) => startDrag(e, 'move', s.id, f)}
                      onKeyDown={(e) => { if (e.key === 'Delete' || e.key === 'Backspace') remove(s.id, f.id); }}
                      onFocus={() => setSelected({ signer: s.id, id: f.id })}>
                      <span>{f.label || fieldLabels[f.type]}{isRequired(f) ? ' *' : ''}</span>
                      {editable && <button type="button" className="sign-field-delete" aria-label="Delete field" onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(s.id, f.id)}>×</button>}
                      {editable && <span className="sign-field-resize" aria-hidden="true" onPointerDown={(e) => startDrag(e, 'resize', s.id, f)} />}
                    </div>
                  );
                }))}
              </div>
            );
          })}
        </div>

        <aside className="sign-props" aria-label="Field properties">
          <h2>Properties</h2>
          {selected && selectedField ? (
            <div className="sign-props-form">
              <label>Field ID<input value={selectedField.id} readOnly /></label>
              <label>Field Type<input value={fieldLabels[selectedField.type]} readOnly /></label>
              <label>Assigned Signer<select value={selected.signer} disabled={!editable} onChange={(e) => moveToSigner(selected.signer, selectedField.id, e.target.value)}>
                {signers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></label>
              <label>Field Label (shown to signer)<input value={selectedField.label ?? ''} maxLength={80} disabled={!editable} placeholder={fieldLabels[selectedField.type]} onChange={(e) => update(selected.signer, selectedField.id, { label: e.target.value })} /></label>
              <div className="sign-props-row">
                <label>X (%)<input type="number" min={0} max={100} step={0.5} value={selectedField.x} disabled={!editable} onChange={(e) => update(selected.signer, selectedField.id, { x: round2(clamp(Number(e.target.value), 0, 100 - selectedField.w)) })} /></label>
                <label>Y (%)<input type="number" min={0} max={100} step={0.5} value={selectedField.y} disabled={!editable} onChange={(e) => update(selected.signer, selectedField.id, { y: round2(clamp(Number(e.target.value), 0, 100 - selectedField.h)) })} /></label>
              </div>
              <label className="admin-check"><input type="checkbox" checked={isRequired(selectedField)} disabled={!editable} onChange={(e) => update(selected.signer, selectedField.id, { required: e.target.checked })} />Required</label>
              {editable && <button type="button" className="admin-link-action danger" onClick={() => remove(selected.signer, selectedField.id)}>Delete field</button>}
            </div>
          ) : <p className="admin-hint">Select a field to edit it. Fields keep their position at any zoom level.</p>}
        </aside>
      </div>
      {toast && <div className={`admin-toast${toast.error ? ' error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.text}</div>}
    </div>
  );
}
