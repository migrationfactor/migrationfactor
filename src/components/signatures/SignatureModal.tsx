'use client';
import { useEffect, useRef, useState } from 'react';

export const signatureFonts = ['Great Vibes', 'Caveat', 'Mrs Saint Delafield', 'Sacramento', 'Alex Brush'] as const;
const inks = [['Black', '#111111'], ['Blue', '#1d3fbf'], ['Red', '#b3121f']] as const;
type Tab = 'type' | 'draw' | 'upload';
export interface SignatureImages { signature: string; initial: string | null }

/** Crops transparent margins so the signature fills its box on the PDF. */
function trimToPng(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x; if (x > right) right = x;
        if (y < top) top = y; if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  const pad = 6;
  const w = Math.min(width, right - left + 1 + pad * 2);
  const h = Math.min(height, bottom - top + 1 + pad * 2);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(canvas, Math.max(0, left - pad), Math.max(0, top - pad), w, h, 0, 0, w, h);
  return out.toDataURL('image/png');
}

async function renderTyped(text: string, font: string, ink: string, width: number): Promise<string | null> {
  if (!text.trim()) return null;
  await document.fonts.load(`72px "${font}"`, text).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let size = 120;
  do { ctx.font = `${size}px "${font}", cursive`; size -= 4; } while (ctx.measureText(text).width > width - 40 && size > 24);
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, canvas.height / 2);
  return trimToPng(canvas);
}

/** Freehand pad for mouse, pen and touch (pointer events, with page scrolling disabled on the pad). */
function Pad({ label, ink, width, onChange }: { label: string; ink: string; width: number; onChange: (empty: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<[number, number] | null>(null);
  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * e.currentTarget.width, ((e.clientY - rect.top) / rect.height) * e.currentTarget.height];
  };
  return (
    <div className="sig-pad">
      <div className="sig-pad-head"><span>{label}</span><button type="button" className="sig-link" onClick={() => {
        const c = canvas.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); onChange(true);
      }}>Clear</button></div>
      <canvas ref={canvas} width={width} height={220} aria-label={`${label} drawing area`} data-pad={label}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; last.current = point(e); }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const p = point(e);
          ctx.strokeStyle = ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(...last.current); ctx.lineTo(...p); ctx.stroke();
          last.current = p;
          onChange(false);
        }}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }} />
    </div>
  );
}

interface Props { open: boolean; defaultName: string; needsInitial: boolean; onClose: () => void; onApply: (images: SignatureImages) => void }

export default function SignatureModal({ open, defaultName, needsInitial, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('type');
  const [ink, setInk] = useState<string>(inks[0][1]);
  const [name, setName] = useState(defaultName);
  const [initials, setInitials] = useState(() => defaultName.split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase()).join('').slice(0, 4));
  const [font, setFont] = useState<string>(signatureFonts[0]);
  const [padsEmpty, setPadsEmpty] = useState({ signature: true, initial: true });
  const [upload, setUpload] = useState<string | null>(null);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  function readUpload(file: File | undefined) {
    setError('');
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { setError('Upload a PNG or JPG image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('The image must be smaller than 5 MB.'); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1000 / img.width, 400 / img.height);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      setUpload(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); setError('That image could not be read.'); };
    img.src = url;
  }

  async function apply() {
    setError('');
    let signature: string | null = null;
    let initial: string | null = null;
    if (tab === 'type') {
      signature = await renderTyped(name, font, ink, 900);
      initial = needsInitial ? await renderTyped(initials, font, ink, 420) : null;
    } else if (tab === 'draw') {
      const pads = root.current?.querySelectorAll<HTMLCanvasElement>('canvas[data-pad]');
      if (pads?.[0] && !padsEmpty.signature) signature = trimToPng(pads[0]);
      if (pads?.[1] && !padsEmpty.initial) initial = trimToPng(pads[1]);
    } else {
      signature = upload;
    }
    if (!signature) { setError(tab === 'upload' ? 'Upload your signature image.' : tab === 'draw' ? 'Draw your signature.' : 'Type your name.'); return; }
    if (signature.length > 2.7 * 1024 * 1024) { setError('The signature image is too large. Use a smaller image.'); return; }
    onApply({ signature, initial });
  }

  return (
    <dialog ref={dialog} className="sig-modal" aria-labelledby="sig-title" onClose={onClose} onCancel={onClose}>
      <div ref={root}>
        <h2 id="sig-title">Adopt your signature</h2>
        <div className="sig-tabs" role="tablist">
          {(['type', 'draw', 'upload'] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(''); }}>{t.toUpperCase()}</button>
          ))}
        </div>

        {tab === 'type' && <div className="sig-type">
          <div className="sig-type-inputs">
            <label>Signature Name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
            {needsInitial && <label>Initial<input value={initials} maxLength={6} onChange={(e) => setInitials(e.target.value)} /></label>}
          </div>
          <div className="sig-fonts" role="radiogroup" aria-label="Signature style">
            {signatureFonts.map((f) => (
              <label key={f} className={`sig-font${font === f ? ' is-selected' : ''}`}>
                <input type="radio" name="sig-font" checked={font === f} onChange={() => setFont(f)} />
                <span style={{ fontFamily: `"${f}", cursive`, color: ink }}>{name || 'Your Name'}</span>
                {needsInitial && <span className="sig-font-initial" style={{ fontFamily: `"${f}", cursive`, color: ink }}>{initials}</span>}
              </label>
            ))}
          </div>
        </div>}
        {tab === 'draw' && <div className="sig-draw">
          <Pad label="Signature" ink={ink} width={900} onChange={(empty) => setPadsEmpty((p) => ({ ...p, signature: empty }))} />
          {needsInitial && <Pad label="Initial" ink={ink} width={420} onChange={(empty) => setPadsEmpty((p) => ({ ...p, initial: empty }))} />}
        </div>}
        {tab === 'upload' && <div className="sig-upload">
          <label className="sig-upload-drop">Upload a scan of your signature (PNG, JPG or JPEG)<input type="file" accept="image/png,image/jpeg" onChange={(e) => readUpload(e.target.files?.[0])} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview, nothing to optimise */}
          {upload && <img src={upload} alt="Uploaded signature preview" />}
        </div>}

        <div className="sig-ink" role="radiogroup" aria-label="Ink colour">
          <span>Ink colour</span>
          {inks.map(([label, value]) => (
            <label key={value} className={ink === value ? 'is-selected' : undefined}>
              <input type="radio" name="sig-ink" checked={ink === value} onChange={() => setInk(value)} />
              <span className="sig-ink-dot" style={{ background: value }} aria-hidden="true" />{label}
            </label>
          ))}
        </div>
        <p className="sig-note">Fills the signature in all places{needsInitial ? ' (and the initial in every initial field)' : ''}.</p>
        {error && <p className="sig-error" role="alert">{error}</p>}
        <div className="sig-actions">
          <button type="button" className="sign-btn" onClick={apply}>Adopt and Sign</button>
          <button type="button" className="sig-link" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}
