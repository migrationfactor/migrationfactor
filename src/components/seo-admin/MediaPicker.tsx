'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { PickedMedia } from './BlockEditor';

/** Modal media library: search, upload (with required alt text) and pick an image. */
export default function MediaPicker({ onPick, onClose }: { onPick: (m: PickedMedia) => void; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/media?limit=60${search ? `&q=${encodeURIComponent(search)}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load media.');
      setItems(data.media || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const upload = async (file: File) => {
    if (!alt.trim()) { setError('Enter alt text first (describe the image), then choose the file.'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('alt_text', alt.trim());
      const res = await fetch('/api/v1/media', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed.');
      const m = data.media || data;
      onPick({ id: m.id, url: m.url, alt: m.alt || alt.trim(), width: m.width, height: m.height });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Media library" style={{ position: 'fixed', inset: 0, background: 'rgba(4,38,40,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(900px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#1d2327' }}>Media library</h3>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', border: '1px solid #c3c4c7', background: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or alt text" style={{ flex: '1 1 220px', padding: '8px 12px', border: '1px solid #8c8f94', borderRadius: 6 }} />
          <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text for new upload (required)" style={{ flex: '1 1 260px', padding: '8px 12px', border: '1px solid #8c8f94', borderRadius: 6 }} />
          <label style={{ padding: '8px 14px', background: '#3858e9', color: '#fff', borderRadius: 6, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : 'Upload'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" hidden disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
        </div>
        {error && <div style={{ color: '#d63638', fontSize: '0.85rem', marginBottom: 8 }}>{error}</div>}
        {loading ? <div>Loading…</div> : items.length === 0 ? <div style={{ color: '#50575e' }}>No images yet. Upload one above.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {items.map((m) => (
              <button key={m.id} type="button" onClick={() => onPick({ id: m.id, url: m.url, alt: m.alt || '', width: m.width, height: m.height })} style={{ border: '1px solid #c3c4c7', borderRadius: 8, padding: 6, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <img src={m.url} alt="" loading="lazy" style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }} />
                <div style={{ fontSize: '0.72rem', color: '#1d2327', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename}</div>
                {!m.alt && <div style={{ fontSize: '0.7rem', color: '#d63638' }}>Missing alt text</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
