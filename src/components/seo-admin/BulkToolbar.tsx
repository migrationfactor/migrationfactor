'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS: Array<{ id: string; label: string; danger?: boolean }> = [
  { id: 'trash', label: 'Move to trash', danger: true },
  { id: 'restore', label: 'Restore from trash' },
  { id: 'set_noindex', label: 'Set noindex' },
  { id: 'set_index', label: 'Set index' },
  { id: 'sitemap_include', label: 'Include in sitemap' },
  { id: 'sitemap_exclude', label: 'Exclude from sitemap' },
  { id: 'delete_permanent', label: 'Delete permanently', danger: true },
];

/** Bulk actions for the posts table. Checkboxes (name="sel") are rendered by the server table; every action is two-step (preview, then confirm). */
export default function BulkToolbar() {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => setIds(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sel"]:checked')).map((i) => i.value));
    document.addEventListener('change', read);
    return () => document.removeEventListener('change', read);
  }, []);

  const toggleAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>('input[name="sel"]').forEach((i) => { i.checked = on; });
    setIds(on ? Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sel"]')).map((i) => i.value) : []);
  };

  const post = async (body: any) => {
    const res = await fetch('/api/v1/posts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed.');
    return data;
  };

  const start = async () => {
    setBusy(true); setMsg('');
    try { setPreview(await post({ action, ids })); setConfirmText(''); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await post({ action, ids, token: preview.token, confirm: confirmText });
      setPreview(null); setIds([]); toggleAll(false);
      setMsg(`${r.done} post(s) updated${r.failed?.length ? `, ${r.failed.length} failed: ${r.failed[0].message}` : ''}.`);
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const a = ACTIONS.find((x) => x.id === action);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <button type="button" onClick={() => toggleAll(true)} style={{ padding: '6px 10px', border: '1px solid #cfe3e3', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>Select page</button>
      <button type="button" onClick={() => toggleAll(false)} style={{ padding: '6px 10px', border: '1px solid #cfe3e3', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
      <span style={{ fontSize: '0.8rem', color: '#3d5557' }}>{ids.length} selected</span>
      <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #b9d3d4', borderRadius: 6, fontSize: '0.8rem' }} aria-label="Bulk action">
        <option value="">Bulk action…</option>
        {ACTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <button type="button" disabled={!action || ids.length === 0 || busy} onClick={start} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#0b666a', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', opacity: !action || ids.length === 0 ? 0.5 : 1 }}>Review</button>
      {msg && <span role="status" style={{ fontSize: '0.8rem', color: '#07484b' }}>{msg}</span>}

      {preview && (
        <div role="dialog" aria-modal="true" onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(4,38,40,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(520px, 100%)', padding: 20, maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ margin: '0 0 8px', color: '#042628' }}>{a?.label}: {preview.count} post(s)</h3>
            <ul style={{ fontSize: '0.85rem', paddingLeft: 18, margin: '0 0 12px' }}>
              {preview.affected.slice(0, 15).map((p: any) => <li key={p.id}>{p.title} <span style={{ color: '#3d5557' }}>({p.status})</span></li>)}
              {preview.affected.length > 15 && <li>…and {preview.affected.length - 15} more</li>}
            </ul>
            {action === 'delete_permanent' && (
              <>
                <p style={{ color: '#a01b2b', fontSize: '0.85rem' }}>This cannot be undone. Type DELETE to confirm.</p>
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #b9d3d4', borderRadius: 6, boxSizing: 'border-box' }} />
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setPreview(null)} style={{ padding: '7px 12px', border: '1px solid #cfe3e3', background: '#fff', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={busy || (action === 'delete_permanent' && confirmText !== 'DELETE')} onClick={confirm} style={{ padding: '7px 14px', border: 'none', borderRadius: 6, background: a?.danger ? '#a01b2b' : '#0b666a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
