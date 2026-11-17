'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/seo-admin/DataTable';

const card: React.CSSProperties = { background: '#ffffff', padding: 22, borderRadius: 12, border: '1px solid #cfe3e3', marginBottom: 18 };
const btn = (primary = true, danger = false): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: primary ? 'none' : '1px solid #b9d3d4',
  background: danger ? '#a01b2b' : primary ? '#0b666a' : '#ffffff',
  color: primary || danger ? '#ffffff' : '#042628',
  fontWeight: 700,
  fontSize: '0.8125rem',
  cursor: 'pointer',
});
const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'CCBot', 'Google-Extended'];

type Validation = { errors: string[]; dangers: string[]; warnings: string[] };

function botBlocked(text: string, bot: string): boolean {
  const re = new RegExp(`user-agent:\\s*${bot}\\s*\\n(?:[^\\n]*\\n)*?disallow:\\s*/\\s*(\\n|$)`, 'i');
  return re.test(text.replace(/\r/g, '') + '\n');
}

function setBotRule(text: string, bot: string, block: boolean): string {
  const without = text.replace(new RegExp(`\\n?user-agent:\\s*${bot}\\s*\\n(?:(?:allow|disallow|crawl-delay):[^\\n]*\\n?)*`, 'ig'), '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  return block ? `${without}\n\nUser-agent: ${bot}\nDisallow: /\n` : `${without}\n`;
}

export default function RobotsTxtAdminPage() {
  const [saved, setSaved] = useState('');
  const [content, setContent] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<{ validation: Validation; diff: Array<{ type: string; text: string }> } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [testPath, setTestPath] = useState('/blog/');
  const [testAgent, setTestAgent] = useState('Googlebot');
  const [testResult, setTestResult] = useState<any>(null);
  const [llms, setLlms] = useState<{ enabled: boolean; content: string; searchGenerativeAi: string; recordedAt: string | null }>({ enabled: false, content: '', searchGenerativeAi: '', recordedAt: null });

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([fetch('/api/v1/robots-txt'), fetch('/api/v1/settings/llms')]);
    if (r.ok) {
      const d = await r.json();
      setSaved(d.content || '');
      setContent(d.content || '');
      setVersions(d.versions || []);
    }
    if (l.ok) setLlms(await l.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = content !== saved;
  const lines = useMemo(() => content.split('\n').length, [content]);

  const review = async () => {
    setBusy(true);
    setMessage('');
    setConfirmText('');
    const res = await fetch('/api/v1/robots-txt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage('Error: ' + (d.message || 'Could not validate.'));
    setPreview(d);
  };

  const save = async () => {
    setBusy(true);
    const res = await fetch('/api/v1/robots-txt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, note: note || 'Manual edit', confirm: confirmText }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage('Error: ' + (d.message || 'Save failed.'));
    setMessage('Saved. The new robots.txt is live and the change is in the audit log.');
    setPreview(null);
    setNote('');
    load();
  };

  const rollback = async (id: string) => {
    const typed = confirm('Restore this version as the active robots.txt?') ? (prompt('If this version contains dangerous rules, type CONFIRM (otherwise leave empty):') ?? '') : null;
    if (typed === null) return;
    const res = await fetch('/api/v1/robots-txt', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: id, confirm: typed }) });
    const d = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Version restored.' : 'Error: ' + (d.message || 'Restore failed.'));
    load();
  };

  const runTest = async () => {
    const res = await fetch('/api/v1/robots-txt/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: testPath, userAgent: testAgent, content }) });
    setTestResult(await res.json().catch(() => null));
  };

  const saveLlms = async () => {
    const res = await fetch('/api/v1/settings/llms', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(llms) });
    const d = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'AI & crawler settings saved.' : 'Error: ' + (d.message || 'Could not save.'));
    load();
  };

  const mustConfirm = Boolean(preview?.validation.dangers.length);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader title="Robots.txt, AI crawlers & llms.txt" subtitle="Controls what crawlers may fetch. Wrong rules can remove your site from Google, so every change is validated, reviewed and versioned. robots.txt is not an indexing control: use noindex for that." />
      {message && (
        <div style={{ padding: '10px 16px', background: message.startsWith('Error') ? '#f1e4e4' : '#e9f3f3', border: '1px solid ' + (message.startsWith('Error') ? '#e3c3c7' : '#d4efec'), borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>
          {message}
        </div>
      )}

      <div style={card}>
        <div style={{ fontWeight: 700, color: '#042628', marginBottom: 8 }}>robots.txt</div>
        <div style={{ display: 'flex', border: '1px solid #b9d3d4', borderRadius: 8, overflow: 'hidden', background: '#f2f8f8' }}>
          <pre aria-hidden style={{ margin: 0, padding: '14px 8px', textAlign: 'right', color: '#6b8486', fontSize: '0.85rem', lineHeight: 1.5, userSelect: 'none', borderRight: '1px solid #d4e5e5' }}>
            {Array.from({ length: Math.max(lines, 12) }, (_, i) => i + 1).join('\n')}
          </pre>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setPreview(null);
            }}
            rows={Math.max(lines, 12)}
            spellCheck={false}
            style={{ flex: 1, padding: 14, border: 'none', background: 'transparent', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.5, outline: 'none', resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Change note (optional)" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #b9d3d4' }} />
          <button style={btn()} disabled={busy || !dirty} onClick={review}>
            Review changes
          </button>
          <button style={btn(false)} disabled={busy || !dirty} onClick={() => { setContent(saved); setPreview(null); }}>
            Discard
          </button>
          <a href="/robots.txt" target="_blank" rel="noopener noreferrer" style={{ ...btn(false), textDecoration: 'none' }}>
            View live ↗
          </a>
        </div>

        {preview && (
          <div style={{ marginTop: 16 }}>
            {preview.validation.errors.map((e) => (
              <div key={e} style={{ color: '#a01b2b', fontSize: '0.85rem' }}>✖ {e}</div>
            ))}
            {preview.validation.dangers.map((d) => (
              <div key={d} style={{ color: '#a01b2b', fontWeight: 700, fontSize: '0.85rem' }}>⚠ DANGER: {d}</div>
            ))}
            {preview.validation.warnings.map((w) => (
              <div key={w} style={{ color: '#8a5a00', fontSize: '0.85rem' }}>• {w}</div>
            ))}
            <pre style={{ marginTop: 10, padding: 12, background: '#f8fbfb', border: '1px solid #d4e5e5', borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto' }}>
              {preview.diff.map((l, i) => (
                <div key={i} style={{ background: l.type === 'add' ? '#e4f4ee' : l.type === 'remove' ? '#f6e3e6' : 'transparent' }}>
                  {l.type === 'add' ? '+ ' : l.type === 'remove' ? '- ' : '  '}
                  {l.text}
                </div>
              ))}
            </pre>
            {mustConfirm && (
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type CONFIRM to accept the danger" style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, border: '2px solid #a01b2b', width: 280 }} />
            )}
            <div style={{ marginTop: 12 }}>
              <button style={btn(true, mustConfirm)} disabled={busy || preview.validation.errors.length > 0 || (mustConfirm && confirmText !== 'CONFIRM')} onClick={save}>
                Save and publish this robots.txt
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: '#042628', marginBottom: 8 }}>Tester</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={testPath} onChange={(e) => setTestPath(e.target.value)} placeholder="/blog/my-post" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #b9d3d4' }} />
          <select value={testAgent} onChange={(e) => setTestAgent(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #b9d3d4', background: '#fff' }}>
            {['Googlebot', 'Bingbot', ...AI_BOTS, '*'].map((a) => <option key={a}>{a}</option>)}
          </select>
          <button style={btn()} onClick={runTest}>Test</button>
        </div>
        {testResult && (
          <p style={{ marginTop: 10, fontWeight: 700, color: testResult.allowed ? '#0b666a' : '#a01b2b' }}>
            {testResult.allowed ? 'Allowed' : 'Blocked'}
            {testResult.matchedRule ? ` — matching rule: ${testResult.matchedRule}` : ' — no rule matches'}
          </p>
        )}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: '#042628', marginBottom: 4 }}>AI crawlers</div>
        <p style={{ fontSize: '0.8125rem', color: '#3d5557', margin: '0 0 12px' }}>
          Ticking a bot adds a Disallow rule to the editor above (review and save to apply). <strong>Google-Extended</strong> controls use of your content for some Google AI models; it does not affect Google Search or AI Overviews. Blocking Googlebot is never offered here because it would remove the site from Google.
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {AI_BOTS.map((bot) => (
            <label key={bot} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={botBlocked(content, bot)} onChange={(e) => { setContent(setBotRule(content, bot, e.target.checked)); setPreview(null); }} />
              Block {bot}
            </label>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: '#042628', marginBottom: 4 }}>llms.txt (optional)</div>
        <p style={{ fontSize: '0.8125rem', color: '#3d5557', margin: '0 0 10px' }}>
          Some AI services read /llms.txt. Google Search does not use it and it has no effect on Google rankings. Off by default.
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem', marginBottom: 8 }}>
          <input type="checkbox" checked={llms.enabled} onChange={(e) => setLlms({ ...llms, enabled: e.target.checked })} /> Serve /llms.txt
        </label>
        <textarea rows={6} value={llms.content} onChange={(e) => setLlms({ ...llms, content: e.target.value })} placeholder={'# Migration Factor\n> Australian migration guides\n\n- [Blog](https://migrationfactor.com/blog)'} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '1px solid #b9d3d4', fontFamily: 'monospace', fontSize: '0.85rem' }} />
        <div style={{ marginTop: 12, fontSize: '0.8125rem' }}>
          <label>
            "Search generative AI" setting in Search Console (changed there, not here) — recorded value:{' '}
            <select value={llms.searchGenerativeAi} onChange={(e) => setLlms({ ...llms, searchGenerativeAi: e.target.value })} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #b9d3d4' }}>
              <option value="">Not recorded</option>
              <option value="include">Include</option>
              <option value="exclude">Exclude</option>
            </select>
          </label>
          {llms.recordedAt && <span style={{ color: '#6b8486' }}> (recorded {new Date(llms.recordedAt).toLocaleDateString()})</span>}
        </div>
        <div style={{ marginTop: 12 }}>
          <button style={btn()} onClick={saveLlms}>Save AI & llms.txt settings</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, color: '#042628', marginBottom: 8 }}>Version history</div>
        {versions.length === 0 && <p style={{ color: '#6b8486', fontSize: '0.85rem' }}>No saved versions yet (the built-in default is used).</p>}
        {versions.map((v) => (
          <div key={v.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e3eeee', fontSize: '0.8125rem' }}>
            <span style={{ flex: 1 }}>
              {new Date(v.created_at).toLocaleString()} · {v.created_by || 'system'} · {v.note}
              {v.active && <strong style={{ color: '#0b666a' }}> (active)</strong>}
            </span>
            {!v.active && <button style={btn(false)} onClick={() => rollback(v.id)}>Restore</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
