'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/seo-admin/DataTable';

const card: React.CSSProperties = { background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #c3c4c7', marginBottom: 20 };
const btn = (primary = true): React.CSSProperties => ({
  padding: '9px 16px',
  borderRadius: 8,
  border: primary ? 'none' : '1px solid #8c8f94',
  background: primary ? '#3858e9' : '#ffffff',
  color: primary ? '#ffffff' : '#1d2327',
  fontWeight: 700,
  fontSize: '0.8125rem',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
});

export default function IntegrationsPage() {
  const [conn, setConn] = useState<any>(null);
  const [props, setProps] = useState<any[]>([]);
  const [indexNow, setIndexNow] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, n] = await Promise.all([fetch('/api/v1/integrations/gsc'), fetch('/api/v1/integrations/indexnow')]);
    if (c.ok) {
      const data = await c.json();
      setConn(data);
      if (data.connected) {
        const p = await fetch('/api/v1/integrations/gsc/properties');
        if (p.ok) setProps(await p.json());
      }
    }
    if (n.ok) setIndexNow(await n.json());
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('connected')) setMessage('Connected to Google Search Console. Now choose your property.');
    if (q.get('error')) setMessage('Error: ' + q.get('error'));
    load();
  }, [load]);

  const act = async (fn: () => Promise<Response>, ok: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const data = await res.json().catch(() => ({}));
      setMessage(res.ok ? data.message || ok : 'Error: ' + (data.message || 'Request failed.'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!conn) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader
        title="Integrations"
        subtitle="Google Search Console and IndexNow. These send hints and read reports; they never guarantee crawling, indexing, rich results or rankings."
      />
      {message && (
        <div style={{ padding: '10px 16px', background: message.startsWith('Error') ? '#fcf0f1' : '#f0f0f1', border: '1px solid ' + (message.startsWith('Error') ? '#f1adad' : '#f0f6fc'), borderRadius: 8, marginBottom: 20, fontSize: '0.875rem' }}>
          {message}
        </div>
      )}

      <div style={card}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1d2327' }}>Google Search Console</h2>
        {!conn.configured && (
          <div style={{ fontSize: '0.85rem', color: '#614200', background: '#fcf9e8', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            <strong>Setup needed:</strong> create an OAuth client (type: Web application) in Google Cloud, enable the <em>Google Search Console API</em>, add this redirect URI:
            <code style={{ display: 'block', margin: '6px 0', wordBreak: 'break-all' }}>{conn.redirectUri}</code>
            then set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the server environment and redeploy.
          </div>
        )}
        <p style={{ fontSize: '0.875rem', margin: '0 0 12px', color: '#50575e' }}>
          Status: <strong>{conn.connected ? 'Connected' : conn.status === 'expired' ? 'Access expired — reconnect' : 'Not connected'}</strong>
          {conn.email ? ` as ${conn.email}` : ''}
          {conn.connected ? ` · ${conn.canSubmitSitemaps ? 'full access (can submit sitemaps)' : 'read-only (inspection and analytics only)'}` : ''}
        </p>

        {!conn.connected ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/api/v1/integrations/gsc/oauth/start?mode=write" style={btn()} aria-disabled={!conn.configured}>
              Connect (full access)
            </a>
            <a href="/api/v1/integrations/gsc/oauth/start?mode=read" style={btn(false)}>
              Connect read-only
            </a>
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, margin: '8px 0 4px' }}>Property</label>
            <select
              value={conn.property || ''}
              onChange={(e) =>
                act(
                  () => fetch('/api/v1/integrations/gsc/properties', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteUrl: e.target.value }) }),
                  'Property saved.'
                )
              }
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #8c8f94', background: '#fff' }}
            >
              <option value="">Select a property…</option>
              {props.map((p) => (
                <option key={p.siteUrl} value={p.siteUrl}>
                  {p.siteUrl} ({p.permissionLevel}){p.matchesSite ? '' : ' – does not cover this site'}
                </option>
              ))}
            </select>

            {conn.property && (
              <div style={{ marginTop: 16, fontSize: '0.85rem', color: '#50575e' }}>
                <div>
                  Sitemap: {conn.sitemap
                    ? `last downloaded by Google ${conn.sitemap.lastDownloaded ? new Date(conn.sitemap.lastDownloaded).toLocaleString() : 'not yet'} · ${conn.sitemap.errors} errors · ${conn.sitemap.warnings} warnings${conn.sitemap.isPending ? ' · pending' : ''}`
                    : 'status not checked yet'}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  <button disabled={busy || !conn.canSubmitSitemaps} style={btn()} onClick={() => act(() => fetch('/api/v1/sitemaps/submit', { method: 'POST' }), 'Sitemap submitted.')}>
                    Submit sitemap now
                  </button>
                  <button disabled={busy} style={btn(false)} onClick={() => act(() => fetch('/api/v1/sitemaps/submit'), 'Sitemap status refreshed.')}>
                    Refresh sitemap status
                  </button>
                </div>
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <button
                disabled={busy}
                style={{ ...btn(false), color: '#d63638', borderColor: '#f1adad' }}
                onClick={() => confirm('Disconnect Search Console and delete the stored Google credentials?') && act(() => fetch('/api/v1/integrations/gsc', { method: 'DELETE' }), 'Disconnected.')}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1d2327' }}>IndexNow</h2>
        <p style={{ fontSize: '0.85rem', color: '#50575e', margin: '0 0 12px' }}>
          IndexNow notifies Bing and other participating engines. <strong>It is not used by Google.</strong>
          {indexNow && <> Key file: <code>{indexNow.keyUrl}</code></>}
        </p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={Boolean(indexNow?.enabled)}
            disabled={busy}
            onChange={(e) =>
              act(() => fetch('/api/v1/integrations/indexnow', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: e.target.checked }) }), 'IndexNow setting saved.')
            }
          />
          Send changed URLs to IndexNow when I request indexing
        </label>
      </div>
    </div>
  );
}
