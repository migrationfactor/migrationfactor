'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const line = '#c3c4c7';
const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: 6, border: `1px solid ${line}`, background: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', color: '#1d2327' };
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem', boxSizing: 'border-box' };

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
        <h3 style={{ margin: '0 0 12px', color: '#1d2327' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** Schedule, submit for review, unpublish, trash and duplicate (FR-BLG-004..008). */
export function WorkflowActions({ postId, status, canPublish, canDelete, onMessage, onStatus, ensureSaved, wp }: {
  wp?: boolean;
  postId: string;
  status: string;
  canPublish: boolean;
  canDelete: boolean;
  onMessage: (m: string) => void;
  onStatus: (s: string) => void;
  ensureSaved: () => Promise<boolean>;
}) {
  const router = useRouter();
  const lnk: React.CSSProperties = { border: 'none', background: 'none', padding: 0, color: '#3858e9', textDecoration: 'underline', cursor: 'pointer', fontSize: 13, textAlign: 'left' };
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
      <div style={wp ? { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 22 } : { display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {status !== 'published' && status !== 'scheduled' && <button type="button" style={wp ? lnk : btn} onClick={() => run(async () => { if (!(await ensureSaved())) return; const r = await call(`/api/v1/posts/${postId}/submit-review`, 'POST'); onStatus(r.status || 'pending_review'); onMessage('Submitted for review.'); })}>Submit for review</button>}
        {canPublish && status !== 'published' && <button type="button" style={wp ? lnk : btn} onClick={() => setDlg('schedule')}>Schedule…</button>}
        {canPublish && status === 'published' && <button type="button" style={wp ? lnk : btn} onClick={() => { setBehavior('404'); setDlg('unpublish'); }}>Unpublish…</button>}
        <button type="button" style={wp ? lnk : btn} onClick={() => run(async () => { const r = await call(`/api/v1/posts/${postId}/duplicate`, 'POST'); router.push(`/seo-admin/blog/${r.post.id}`); })}>Duplicate</button>
        {canDelete && <button type="button" style={wp ? { ...lnk, color: '#b32d2e' } : { ...btn, color: '#d63638' }} onClick={() => { setBehavior('410'); setDlg('trash'); }}>Move to trash…</button>}
      </div>
      {err && !dlg && <div style={{ color: '#d63638', fontSize: '0.8rem' }}>{err}</div>}

      {dlg === 'schedule' && (
        <Modal title="Schedule publishing" onClose={() => setDlg(null)}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Publish at (your local time)</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...input, marginTop: 4 }} />
          <p style={{ fontSize: '0.78rem', color: '#50575e' }}>The same checks as a normal publish run at the scheduled time. The post is published by the scheduler, so it can go live a few minutes late.</p>
          {err && <div style={{ color: '#d63638', fontSize: '0.8rem' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button type="button" disabled={!when || busy} style={{ ...btn, background: '#3858e9', color: '#fff' }} onClick={() => run(async () => {
              if (!(await ensureSaved())) return;
              await call(`/api/v1/posts/${postId}/schedule`, 'POST', { publish_at: new Date(when).toISOString() });
              onStatus('scheduled'); onMessage('Scheduled.'); setDlg(null); router.refresh();
            })}>Schedule</button>
          </div>
        </Modal>
      )}

      {(dlg === 'unpublish' || dlg === 'trash') && (
        <Modal title={dlg === 'trash' ? 'Move to trash' : 'Unpublish this post'} onClose={() => setDlg(null)}>
          <p style={{ fontSize: '0.85rem', color: '#1d2327', marginTop: 0 }}>What should visitors and Google see at the old address?</p>
          {(['404', '410', '301'] as const).filter((b) => dlg === 'unpublish' || b !== '404').map((b) => (
            <label key={b} style={{ display: 'block', fontSize: '0.85rem', margin: '6px 0' }}>
              <input type="radio" checked={behavior === b} onChange={() => setBehavior(b)} />{' '}
              {b === '404' ? '404 Not found (temporary removal)' : b === '410' ? '410 Gone (permanent removal)' : '301 Redirect to another page'}
            </label>
          ))}
          {behavior === '301' && <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/blog/replacement-post or https://…" style={{ ...input, marginTop: 6 }} />}
          {err && <div style={{ color: '#d63638', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button type="button" disabled={busy || (behavior === '301' && !target)} style={{ ...btn, background: '#d63638', color: '#fff', borderColor: '#d63638' }} onClick={() => run(async () => {
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

/** Revision history in the WordPress list style. Restoring loads the revision into the editor; it never saves or publishes (FR-BLG-011). */
export function RevisionsPanel({ postId, onRestore }: { postId: string; onRestore: (payload: any) => void }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { call(`/api/v1/posts/${postId}/revisions`, 'GET').then(setRows as any).catch((e) => setErr(e.message)); }, [postId]);
  const ago = (d: string) => {
    const m = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
    if (m < 60) return m + (m === 1 ? ' min' : ' mins') + ' ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour' : ' hours') + ' ago';
    const days = Math.round(h / 24);
    if (days < 14) return days + (days === 1 ? ' day' : ' days') + ' ago';
    const w = Math.round(days / 7);
    return w + ' weeks ago';
  };
  if (err) return <div style={{ color: '#d63638', fontSize: 13 }}>{err}</div>;
  if (!rows) return <div style={{ fontSize: 13 }}>Loading…</div>;
  if (!rows.length) return <div style={{ fontSize: 13, color: '#50575e' }}>No revisions yet.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 3, background: '#dcdcde', flex: 'none' }} />
          <span>
            {r.created_by_name || 'System'}, {ago(r.created_at)} (
            <button type="button" style={{ border: 'none', background: 'none', padding: 0, color: '#3858e9', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }} onClick={async () => {
              try {
                const rev = await call(`/api/v1/posts/${postId}/revisions/${r.revision_no}`, 'GET');
                if (!rev.restorable) { setErr('This older revision is partial and cannot be restored.'); return; }
                if (confirm('Load this revision into the editor? Nothing is saved until you click Update.')) onRestore(rev.editorPayload);
              } catch (e: any) { setErr(e.message); }
            }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} @ {new Date(r.created_at).toLocaleTimeString('en-GB')}</button>
            )
          </span>
        </div>
      ))}
    </div>
  );
}

/** "Move to Trash" link with the 410 / 301 choice (FR-BLG-008). */
export function MoveToTrash({ postId, onMessage }: { postId: string; onMessage: (m: string) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [behavior, setBehavior] = useState<'410' | '301'>('410');
  const [target, setTarget] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ border: 'none', background: 'none', padding: 0, color: '#b32d2e', textDecoration: 'underline', cursor: 'pointer', fontSize: 13 }}>Move to Trash</button>
      {open && (
        <Modal title="Move to Trash" onClose={() => setOpen(false)}>
          <p style={{ fontSize: 13, marginTop: 0 }}>What should visitors and Google see at the old address?</p>
          {(['410', '301'] as const).map((b) => (
            <label key={b} style={{ display: 'block', fontSize: 13, margin: '6px 0' }}>
              <input type="radio" checked={behavior === b} onChange={() => setBehavior(b)} /> {b === '410' ? '410 Gone (permanent removal)' : '301 Redirect to another page'}
            </label>
          ))}
          {behavior === '301' && <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/blog/replacement-post or https://…" style={{ ...input, marginTop: 6 }} />}
          {err && <div style={{ color: '#d63638', fontSize: 13, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" style={btn} onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" disabled={busy || (behavior === '301' && !target)} style={{ ...btn, background: '#d63638', color: '#fff', borderColor: '#d63638' }} onClick={async () => {
              setBusy(true); setErr('');
              try { await call(`/api/v1/posts/${postId}/trash`, 'POST', { behavior, redirect_target: behavior === '301' ? target : undefined }); onMessage('Post moved to the Trash.'); router.push('/seo-admin/blog'); }
              catch (e: any) { setErr(e.message); } finally { setBusy(false); }
            }}>Move to Trash</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Incoming / outgoing links and suggestions (FR-LNK-002/004). */
export function LinksPanel({ postId }: { postId: string }) {
  const [data, setData] = useState<any>(null);
  const [dups, setDups] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { call(`/api/v1/posts/${postId}/duplicates`, 'GET').then((d) => setDups(d.duplicates || [])).catch(() => undefined); }, [postId]);
  useEffect(() => { call(`/api/v1/posts/${postId}/links`, 'GET').then(setData).catch((e) => setErr(e.message)); }, [postId]);
  if (err) return <div style={{ color: '#d63638', fontSize: '0.85rem' }}>{err}</div>;
  if (!data) return <div style={{ fontSize: '0.85rem' }}>Loading…</div>;
  const sec = (t: string) => <div style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', color: '#50575e', margin: '10px 0 4px' }}>{t}</div>;
  return (
    <div style={{ background: '#fff', border: `1px solid ${line}`, borderRadius: 12, padding: 12, fontSize: '0.8rem' }}>
      {sec(`Incoming internal links (${data.incoming.length})`)}
      {data.incoming.length === 0 && <div style={{ color: '#996800' }}>⚠ Orphan: no published post links here yet.</div>}
      {data.incoming.map((l: any) => <div key={l.id}>{l.source_title} <span style={{ color: '#50575e' }}>“{l.anchor_text}”</span></div>)}
      {sec(`Outgoing links (${data.outgoing.length})`)}
      {data.outgoing.map((l: any) => (
        <div key={l.id} style={{ wordBreak: 'break-all' }}>
          {l.is_internal ? '↪' : '↗'} {l.target_title || l.target_url}{' '}
          {l.last_status && l.last_status >= 400 && <span style={{ color: '#d63638' }}>({l.last_status})</span>}
          {l.last_status && l.last_status >= 300 && l.last_status < 400 && <span style={{ color: '#996800' }}>(redirect)</span>}
        </div>
      ))}
      {dups.length > 0 && (<>{sec('Similar content (possible duplicates)')}{dups.map((d: any) => <div key={d.id} style={{ color: '#996800' }}>⚠ {d.title} <span style={{ color: '#50575e' }}>{d.path} · {d.similarity}% similar</span></div>)}</>)}
      {sec('Suggestions')}
      {(data.suggestions || []).length === 0 && <div style={{ color: '#50575e' }}>No suggestions right now.</div>}
      {(data.suggestions || []).map((s: any) => (
        <div key={s.id}>
          <strong>{s.title}</strong> <span style={{ color: '#50575e' }}>{s.url || s.legacy_path || (s.slug ? `/blog/${s.slug}` : '')}</span>
          {s.reason && <div style={{ color: '#50575e' }}>{s.reason}</div>}
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
      {err && <div style={{ color: '#d63638' }}>{err}</div>}
      {v && v.errors.length === 0 && v.warnings.length === 0 && <div style={{ color: '#3858e9', marginTop: 6 }}>✓ No problems found in the saved version.</div>}
      {v?.errors.map((m: string) => <div key={m} style={{ color: '#d63638', marginTop: 4 }}>✕ {m}</div>)}
      {v?.warnings.map((m: string) => <div key={m} style={{ color: '#996800', marginTop: 4 }}>⚠ {m}</div>)}
      {data && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Preview SEO head</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 260, overflow: 'auto', background: '#f6f7f7', padding: 8, borderRadius: 6 }}>{typeof data.html === 'string' ? data.html : JSON.stringify(data, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

/** Citation manager (FR-GEO-005): sources with title, https URL, publisher and date; order is kept. */
export function ReferencesPanel({ value, onChange, trusted }: { value: any[]; onChange: (v: any[]) => void; trusted: string[] }) {
  const set = (i: number, patch: any) => onChange(value.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= value.length) return; const n = [...value]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const urls = value.map((r) => (r.url || '').trim().toLowerCase());
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 6 }}>Sources and citations</div>
      {value.map((r, i) => {
        const url = (r.url || '').trim();
        const bad = url && !/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url);
        const dup = url && urls.indexOf(url.toLowerCase()) !== i;
        let host = '';
        try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* invalid */ }
        const isTrusted = host && trusted.some((t) => host === t || host.endsWith('.' + t));
        return (
          <div key={i} style={{ border: '1px solid ' + line, borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <input style={{ ...input, marginBottom: 4 }} placeholder="Title of the source" value={r.title || ''} onChange={(e) => set(i, { title: e.target.value })} />
            <input style={{ ...input, marginBottom: 4, borderColor: bad || dup ? '#d63638' : '#8c8f94' }} placeholder="https://…" value={r.url || ''} onChange={(e) => set(i, { url: e.target.value })} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={input} placeholder="Publisher" value={r.publisher || ''} onChange={(e) => set(i, { publisher: e.target.value })} />
              <input style={input} placeholder="Date (YYYY-MM-DD)" value={r.publishedDate || ''} onChange={(e) => set(i, { publishedDate: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: '0.75rem' }}>
              <button type="button" style={btn} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" style={btn} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" style={btn} onClick={() => onChange(value.filter((_, k) => k !== i))}>Remove</button>
              {bad && <span style={{ color: '#d63638' }}>Use a full https:// link.</span>}
              {dup && <span style={{ color: '#d63638' }}>Duplicate source.</span>}
              {isTrusted && <span style={{ color: '#3858e9' }}>✓ Trusted source</span>}
            </div>
          </div>
        );
      })}
      <button type="button" style={btn} onClick={() => onChange([...value, { title: '', url: '', publisher: '', publishedDate: '' }])}>+ Add source</button>
    </div>
  );
}
