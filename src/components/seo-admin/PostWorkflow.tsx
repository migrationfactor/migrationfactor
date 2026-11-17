'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const line = '#cfe3e3';
const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 6, border: `1px solid ${line}`, background: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: '#042628' };
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.85rem', boxSizing: 'border-box' };

async function call(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'Request failed.');
  return data;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(4,38,40,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(480px, 100%)', padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', color: '#042628' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Schedule, submit for review, unpublish, trash and duplicate (FR-BLG-004..008). */
export function WorkflowActions({ postId, status, canPublish, canDelete, onMessage, onStatus, ensureSaved }: {
  postId: string;
  status: string;
  canPublish: boolean;
  canDelete: boolean;
  onMessage: (m: string) => void;
  onStatus: (s: string) => void;
  ensureSaved: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [dlg, setDlg] = useState<null | 'schedule' | 'unpublish' | 'trash'>(null);
  const [when, setWhen] = useState('');
  const [behavior, setBehavior] = useState<'404' | '410' | '301'>('410');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {status !== 'published' && status !== 'scheduled' && <button type="button" style={btn} onClick={() => run(async () => { if (!(await ensureSaved())) return; const r = await call(`/api/v1/posts/${postId}/submit-review`, 'POST'); onStatus(r.status || 'pending_review'); onMessage('Submitted for review.'); })}>Submit for review</button>}
        {canPublish && status !== 'published' && <button type="button" style={btn} onClick={() => setDlg('schedule')}>Schedule…</button>}
        {canPublish && status === 'published' && <button type="button" style={btn} onClick={() => { setBehavior('404'); setDlg('unpublish'); }}>Unpublish…</button>}
        <button type="button" style={btn} onClick={() => run(async () => { const r = await call(`/api/v1/posts/${postId}/duplicate`, 'POST'); router.push(`/seo-admin/blog/${r.post.id}`); })}>Duplicate</button>
        {canDelete && <button type="button" style={{ ...btn, color: '#a01b2b' }} onClick={() => { setBehavior('410'); setDlg('trash'); }}>Move to trash…</button>}
      </div>
      {err && !dlg && <div style={{ color: '#a01b2b', fontSize: '0.8rem' }}>{err}</div>}

      {dlg === 'schedule' && (
        <Modal title="Schedule publishing" onClose={() => setDlg(null)}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Publish at (your local time)</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...input, marginTop: 4 }} />
          <p style={{ fontSize: '0.78rem', color: '#3d5557' }}>The same checks as a normal publish run at the scheduled time. The post is published by the scheduler, so it can go live a few minutes late.</p>
          {err && <div style={{ color: '#a01b2b', fontSize: '0.8rem' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button type="button" disabled={!when || busy} style={{ ...btn, background: '#0b666a', color: '#fff' }} onClick={() => run(async () => {
              if (!(await ensureSaved())) return;
              await call(`/api/v1/posts/${postId}/schedule`, 'POST', { publish_at: new Date(when).toISOString() });
              onStatus('scheduled'); onMessage('Scheduled.'); setDlg(null); router.refresh();
            })}>Schedule</button>
          </div>
        </Modal>
      )}

      {(dlg === 'unpublish' || dlg === 'trash') && (
        <Modal title={dlg === 'trash' ? 'Move to trash' : 'Unpublish this post'} onClose={() => setDlg(null)}>
          <p style={{ fontSize: '0.85rem', color: '#042628', marginTop: 0 }}>What should visitors and Google see at the old address?</p>
          {(['404', '410', '301'] as const).filter((b) => dlg === 'unpublish' || b !== '404').map((b) => (
            <label key={b} style={{ display: 'block', fontSize: '0.85rem', margin: '6px 0' }}>
              <input type="radio" checked={behavior === b} onChange={() => setBehavior(b)} />{' '}
              {b === '404' ? '404 Not found (temporary removal)' : b === '410' ? '410 Gone (permanent removal)' : '301 Redirect to another page'}
            </label>
          ))}
          {behavior === '301' && <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/blog/replacement-post or https://…" style={{ ...input, marginTop: 6 }} />}
          {err && <div style={{ color: '#a01b2b', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button type="button" disabled={busy || (behavior === '301' && !target)} style={{ ...btn, background: '#a01b2b', color: '#fff', borderColor: '#a01b2b' }} onClick={() => run(async () => {
              const payload = { behavior, redirect_target: behavior === '301' ? target : undefined };
              if (dlg === 'trash') { await call(`/api/v1/posts/${postId}/trash`, 'POST', payload); router.push('/seo-admin/blog'); }
              else { await call(`/api/v1/posts/${postId}/unpublish`, 'POST', payload); onStatus('draft'); onMessage('Post unpublished.'); setDlg(null); router.refresh(); }
            })}>{dlg === 'trash' ? 'Move to trash' : 'Unpublish'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Revision history. Restoring loads the revision into the editor; it never saves or publishes (FR-BLG-011). */
export function RevisionsPanel({ postId, onRestore }: { postId: string; onRestore: (payload: any) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { call(`/api/v1/posts/${postId}/revisions`, 'GET').then(setRows as any).catch((e) => setErr(e.message)); }, [postId]);
  if (err) return <div style={{ color: '#a01b2b', fontSize: '0.85rem' }}>{err}</div>;
  if (!rows) return <div style={{ fontSize: '0.85rem' }}>Loading…</div>;
  if (!rows.length) return <div style={{ fontSize: '0.85rem', color: '#3d5557' }}>No revisions yet.</div>;
  return (
    <div style={{ background: '#fff', border: `1px solid ${line}`, borderRadius: 12, padding: 12 }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${line}`, fontSize: '0.8rem' }}>
          <div style={{ flex: 1 }}>
            <strong>#{r.revision_no}</strong> · {r.action}
            <div style={{ color: '#3d5557' }}>{new Date(r.created_at).toLocaleString()} {r.created_by_name ? `· ${r.created_by_name}` : ''}</div>
          </div>
          <button type="button" style={btn} onClick={async () => {
            try {
              const rev = await call(`/api/v1/posts/${postId}/revisions/${r.revision_no}`, 'GET');
              if (!rev.restorable) { setErr('This older revision is partial and cannot be restored.'); return; }
              if (confirm(`Load revision #${r.revision_no} into the editor? Nothing is saved until you click Save.`)) onRestore(rev.editorPayload);
            } catch (e: any) { setErr(e.message); }
          }}>Restore into editor</button>
        </div>
      ))}
    </div>
  );
}

/** Incoming / outgoing links and suggestions (FR-LNK-002/004). */
export function LinksPanel({ postId }: { postId: string }) {
  const [data, setData] = useState<any>(null);
  const [dups, setDups] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { call(`/api/v1/posts/${postId}/duplicates`, 'GET').then((d) => setDups(d.duplicates || [])).catch(() => undefined); }, [postId]);
  useEffect(() => { call(`/api/v1/posts/${postId}/links`, 'GET').then(setData).catch((e) => setErr(e.message)); }, [postId]);
  if (err) return <div style={{ color: '#a01b2b', fontSize: '0.85rem' }}>{err}</div>;
  if (!data) return <div style={{ fontSize: '0.85rem' }}>Loading…</div>;
  const sec = (t: string) => <div style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#3d5557', margin: '10px 0 4px' }}>{t}</div>;
  return (
    <div style={{ background: '#fff', border: `1px solid ${line}`, borderRadius: 12, padding: 12, fontSize: '0.8rem' }}>
      {sec(`Incoming internal links (${data.incoming.length})`)}
      {data.incoming.length === 0 && <div style={{ color: '#8a5a00' }}>⚠ Orphan: no published post links here yet.</div>}
      {data.incoming.map((l: any) => <div key={l.id}>{l.source_title} <span style={{ color: '#3d5557' }}>“{l.anchor_text}”</span></div>)}
      {sec(`Outgoing links (${data.outgoing.length})`)}
      {data.outgoing.map((l: any) => (
        <div key={l.id} style={{ wordBreak: 'break-all' }}>
          {l.is_internal ? '↪' : '↗'} {l.target_title || l.target_url}{' '}
          {l.last_status && l.last_status >= 400 && <span style={{ color: '#a01b2b' }}>({l.last_status})</span>}
          {l.last_status && l.last_status >= 300 && l.last_status < 400 && <span style={{ color: '#8a5a00' }}>(redirect)</span>}
        </div>
      ))}
      {dups.length > 0 && (<>{sec('Similar content (possible duplicates)')}{dups.map((d: any) => <div key={d.id} style={{ color: '#8a5a00' }}>⚠ {d.title} <span style={{ color: '#3d5557' }}>{d.path} · {d.similarity}% similar</span></div>)}</>)}
      {sec('Suggestions')}
      {(data.suggestions || []).length === 0 && <div style={{ color: '#3d5557' }}>No suggestions right now.</div>}
      {(data.suggestions || []).map((s: any) => (
        <div key={s.id}>
          <strong>{s.title}</strong> <span style={{ color: '#3d5557' }}>{s.url || s.legacy_path || (s.slug ? `/blog/${s.slug}` : '')}</span>
          {s.reason && <div style={{ color: '#3d5557' }}>{s.reason}</div>}
        </div>
      ))}
    </div>
  );
}

/** Live head preview and structured-data validation from the server renderer (FR-SCH-004). Shows the last SAVED state. */
export function SchemaPanel({ postId, refreshKey }: { postId: string; refreshKey: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => {
    setBusy(true);
    call('/api/v1/posts/' + postId + '/seo-head', 'GET').then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(load, [postId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = data?.schemaValidation;
  return (
    <div style={{ background: '#fff', border: '1px solid ' + line, borderRadius: 12, padding: 12, fontSize: '0.8rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>Structured data check</strong>
        <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={load} disabled={busy}>{busy ? 'Checking…' : 'Re-check'}</button>
      </div>
      {err && <div style={{ color: '#a01b2b' }}>{err}</div>}
      {v && v.errors.length === 0 && v.warnings.length === 0 && <div style={{ color: '#0b666a', marginTop: 6 }}>✓ No problems found in the saved version.</div>}
      {v?.errors.map((m: string) => <div key={m} style={{ color: '#a01b2b', marginTop: 4 }}>✕ {m}</div>)}
      {v?.warnings.map((m: string) => <div key={m} style={{ color: '#8a5a00', marginTop: 4 }}>⚠ {m}</div>)}
      {data && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Preview SEO head</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 260, overflow: 'auto', background: '#f2f8f8', padding: 8, borderRadius: 6 }}>{typeof data.html === 'string' ? data.html : JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
