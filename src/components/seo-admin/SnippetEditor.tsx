'use client';

import React, { useEffect } from 'react';

const SEG = ['#e2401c', '#f58d1d', '#e8b100', '#9fbf2f', '#5aa832'];

/** Five-segment length meter used by the title, permalink and description cards. */
function Meter({ ratio, over, gradient }: { ratio: number; over: boolean; gradient?: boolean }) {
  const filled = over ? 5 : Math.max(0, Math.min(5, Math.ceil(ratio * 5)));
  return (
    <div aria-hidden style={{ display: 'flex', gap: 2, width: 225, flex: 'none' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ flex: 1, height: 10, background: i < filled ? (over ? SEG[0] : gradient ? SEG[i] : filled >= 3 ? SEG[Math.min(4, filled - 1)] : SEG[0]) : '#e5e5e5' }} />
      ))}
    </div>
  );
}

const card: React.CSSProperties = { background: '#eef0f2', borderRadius: 4, padding: '18px 20px', marginBottom: 16 };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #8c8f94', borderRadius: 4, padding: '12px 14px', fontSize: 16, background: '#fff', color: '#1e1e1e', fontFamily: 'inherit' };
const help: React.CSSProperties = { fontSize: 14, color: '#6b7280', margin: '10px 0 0' };

function Head({ label, counter, meter }: { label: string; counter: string; meter: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
      <strong style={{ fontSize: 16, color: '#1e1e1e' }}>{label}</strong>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#6b7280' }}>{counter}{meter}</span>
    </div>
  );
}

const IconMonitor = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v12H3zM9 20h6M12 16v4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
const IconPhone = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 19h2" stroke="currentColor" strokeWidth="1.6" /></svg>;
const IconGear = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm8.4 5.1l1.8 1.4-2 3.4-2.1-.8a7 7 0 01-1.5.9L16.2 20H12.2l-.4-2.3a7 7 0 01-1.5-.9l-2.1.8-2-3.4 1.8-1.4a7 7 0 010-1.8L6.2 9.6l2-3.4 2.1.8a7 7 0 011.5-.9L12.2 4h4l.4 2.1a7 7 0 011.5.9l2.1-.8 2 3.4-1.8 1.4a7 7 0 010 1.8z" transform="translate(-2 0) scale(.92)" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;

/** "Preview Snippet Editor" side panel: live search-result preview plus title, permalink and description fields. */
export default function SnippetEditor({
  onClose, preview, device, setDevice,
  titleValue, onTitleChange, titleChars, titlePx,
  permalinkValue, permalinkEditable, onPermalinkChange, permalinkLength,
  descValue, onDescChange, descChars, descPx, descPlaceholder,
}: {
  onClose: () => void;
  preview: React.ReactNode;
  device: 'desktop' | 'mobile';
  setDevice: (d: 'desktop' | 'mobile') => void;
  titleValue: string;
  onTitleChange: (v: string) => void;
  titleChars: number;
  titlePx: number;
  permalinkValue: string;
  permalinkEditable: boolean;
  onPermalinkChange: (v: string) => void;
  permalinkLength: number;
  descValue: string;
  onDescChange: (v: string) => void;
  descChars: number;
  descPx: number;
  descPlaceholder?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const titleOver = titleChars > 60 || titlePx > 580;
  const descOver = descChars > 160 || descPx > 920;
  const iconBtn = (active: boolean): React.CSSProperties => ({ width: 40, height: 36, border: '1px solid #c3c4c7', borderRadius: 4, background: active ? '#e7e9ec' : '#fff', cursor: 'pointer', color: '#3c434a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} />
      <div role="dialog" aria-modal="true" aria-label="Preview Snippet Editor" style={{ position: 'relative', width: 'min(840px, 100%)', height: '100%', background: '#fff', boxShadow: '-4px 0 16px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#1e1e1e' }}>Preview Snippet Editor</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#1e1e1e', fontSize: 34, lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ display: 'flex', background: '#f6f7f7', borderTop: '1px solid #dcdcde', borderBottom: '1px solid #dcdcde', padding: '0 20px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 14px', borderBottom: '3px solid #0f9fe0', marginBottom: -1, fontSize: 16, color: '#1e1e1e' }}><IconGear /> General</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <strong style={{ fontSize: 17, color: '#1e1e1e' }}>Preview</strong>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} style={iconBtn(device === 'desktop')}><IconMonitor /></button>
              <button type="button" aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')} style={iconBtn(device === 'mobile')}><IconPhone /></button>
            </span>
          </div>
          <div style={{ marginBottom: 24 }}>{preview}</div>

          <div style={card}>
            <Head label="Title" counter={`${titleChars} / 60 (${titlePx}px / 580px)`} meter={<Meter ratio={titlePx / 580} over={titleOver} />} />
            <input type="text" value={titleValue} onChange={(e) => onTitleChange(e.target.value)} aria-label="Title" style={field} />
            <p style={help}>This is what will appear in the first line when this post shows up in the search results.</p>
          </div>

          <div style={card}>
            <Head label="Permalink" counter={`${permalinkLength} / 75`} meter={<Meter ratio={permalinkLength / 75} over={permalinkLength > 75} />} />
            <input type="text" value={permalinkValue} readOnly={!permalinkEditable} onChange={(e) => onPermalinkChange(e.target.value)} aria-label="Permalink" style={{ ...field, background: permalinkEditable ? '#fff' : '#f6f7f7' }} />
            <p style={help}>This is the unique URL of this page, displayed below the post title in the search results.</p>
          </div>

          <div style={card}>
            <Head label="Description" counter={`${descChars} / 160 (${descPx}px / 920px)`} meter={<Meter ratio={descPx / 920} over={descOver} gradient />} />
            <textarea rows={3} value={descValue} onChange={(e) => onDescChange(e.target.value)} placeholder={descPlaceholder} aria-label="Description" style={{ ...field, resize: 'vertical' }} />
            <p style={help}>This is what will appear as the description when this post shows up in the search results.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
