'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS: Array<{ id: string; label: string; danger?: boolean }> = [
  { id: 'trash', label: 'Move to Trash', danger: true },
  { id: 'restore', label: 'Restore' },
  { id: 'set_index', label: 'Set to index' },
  { id: 'set_noindex', label: 'Set to noindex' },
  { id: 'sitemap_include', label: 'Include in sitemap' },
  { id: 'sitemap_exclude', label: 'Exclude from sitemap' },
  { id: 'delete_permanent', label: 'Delete Permanently', danger: true },
];

const btn: React.CSSProperties = { padding: '0 10px', lineHeight: '28px', minHeight: 30, border: '1px solid #2271b1', borderRadius: 3, background: '#f6f7f7', color: '#2271b1', fontSize: 13, cursor: 'pointer' };

/**
 * WordPress-style "Bulk actions" select with Apply. Checkboxes (name="sel") and the select-all checkboxes
 * (data-select-all) are rendered by the server table. Every action is two-step: preview, then confirm.
 */
export default function BulkToolbar({ position = 'top' }: { position?: 'top' | 'bottom' }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => setIds(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sel"]:checked')).map((i) => i.value));
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t?.dataset?.selectAll !== undefined) {
        document.querySelectorAll<HTMLInputElement>('input[name="sel"]').forEach((i) => { i.checked = t.checked; });
        document.querySelectorAll<HTMLInputElement>('input[data-select-all]').forEach((i) => { i.checked = t.checked; });
      }
      read();
    };
    document.addEventListener('change', onChange);
    return () => document.removeEventListener('change', onChange);
  }, []);

  const post = async (body: any) => {
    const res = await fetch('/api/v1/posts/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed.');
    return data;
  };

  const start = async () => {
    if (!action) return;
    if (ids.length === 0) { setMsg('Select at least one post first.'); return; }
    setBusy(true); setMsg('');
    try { setPreview(await post({ action, ids })); setConfirmText(''); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await post({ action, ids, token: preview.token, confirm: confirmText });
      setPreview(null); setIds([]);
      document.querySelectorAll<HTMLInputElement>('input[name="sel"],input[data-select-all]').forEach((i) => { i.checked = false; });
      setMsg(`${r.done} post(s) updated${r.failed?.length ? `, ${r.failed.length} failed: ${r.failed[0].message}` : ''}.`);
      router.refresh();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const a = ACTIONS.find((x) => x.id === action);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select value={action} onChange={(e) => setAction(e.target.value)} aria-label={position === 'top' ? 'Select bulk action' : 'Select bulk action (bottom)'} style={{ minWidth: 130, minHeight: 30, border: '1px solid #8c8f94', borderRadius: 3, padding: '0 8px', fontSize: 14, background: '#fff', color: '#2c3338' }}>
        <option value="">Bulk actions</option>
        {ACTIONS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <button type="button" disabled={busy} onClick={start} style={btn}>Apply</button>
      {msg && <span role="status" style={{ fontSize: 13, color: '#1d2327', marginLeft: 8 }}>{msg}</span>}

      {preview && (
        <div role="dialog" aria-modal="true" onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: 'min(520px, 100%)', padding: 20, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 3px 6px rgba(0,0,0,.3)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1d2327' }}>{a?.label}: {preview.count} post(s)</h3>
            <ul style={{ fontSize: 13, paddingLeft: 18, margin: '0 0 12px' }}>
              {preview.affected.slice(0, 15).map((p: any) => <li key={p.id}>{p.title} <span style={{ color: '#646970' }}>({p.status})</span></li>)}
              {preview.affected.length > 15 && <li>…and {preview.affected.length - 15} more</li>}
            </ul>
            {action === 'delete_permanent' && (
              <>
                <p style={{ color: '#b32d2e', fontSize: 13 }}>This cannot be undone. Type DELETE to confirm.</p>
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid #8c8f94', boxSizing: 'border-box' }} />
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" onClick={() => setPreview(null)} style={btn}>Cancel</button>
              <button type="button" disabled={busy || (action === 'delete_permanent' && confirmText !== 'DELETE')} onClick={confirm} style={{ ...btn, background: a?.danger ? '#b32d2e' : '#2271b1', borderColor: a?.danger ? '#b32d2e' : '#2271b1', color: '#fff', fontWeight: 600 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
