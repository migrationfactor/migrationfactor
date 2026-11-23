'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const LABELS: Record<string, string> = {
  draft: 'Not submitted',
  submitted: 'Submitted',
  accepted: 'Accepted by a channel',
  crawled: 'Crawled by Google',
  indexed: 'Indexed (confirmed by Google)',
  not_indexed: 'Not indexed (per Google)',
  failed: 'Failed',
};

const button = (primary: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 6,
  backgroundColor: primary ? '#1d2327' : '#ffffff',
  color: primary ? '#ffffff' : '#1d2327',
  fontWeight: 700,
  fontSize: '0.8125rem',
  border: primary ? 'none' : '1px solid #8c8f94',
  cursor: 'pointer',
});

/** Real per-channel indexing status (FR-IDX-003/004/007). "Indexed" only ever comes from a PASS inspection. */
export default function IndexingPanel({ postId, published }: { postId: string; published: boolean }) {
  const [data, setData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/posts/${postId}/indexing`);
    if (res.ok) setData(await res.json());
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (path: string, body?: object) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/posts/${postId}/indexing/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.message || 'Request failed.');
      else setResult(d);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const insp = data?.latestInspection;
  return (
    <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #c3c4c7', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1d2327' }}>Indexing status</div>
      <div style={{ padding: 12, background: '#f6f7f7', borderRadius: 8, border: '1px solid #c3c4c7', fontSize: '0.85rem' }}>
        <div>
          Google index status: <strong style={{ color: '#2271b1' }}>{published ? LABELS[data?.status] || '…' : 'Not published'}</strong>
        </div>
        {insp && (
          <div style={{ fontSize: '0.75rem', color: '#50575e', marginTop: 6, lineHeight: 1.6 }}>
            Coverage: {insp.coverageState || '—'} · Last crawl: {insp.lastCrawlTime ? new Date(insp.lastCrawlTime).toLocaleString() : '—'}
            {insp.googleCanonical && insp.userCanonical && insp.googleCanonical !== insp.userCanonical && (
              <div style={{ color: '#996800' }}>Google chose a different canonical: {insp.googleCanonical}</div>
            )}
          </div>
        )}
        <div style={{ fontSize: '0.75rem', color: '#50575e', marginTop: 6 }}>
          A submission is only a hint. &quot;Indexed&quot; is shown only when Google&apos;s URL Inspection says so. No guarantee of crawling, indexing or rankings.
        </div>
      </div>

      {published ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} style={button(true)} onClick={() => call('request')}>
            Request indexing
          </button>
          <button type="button" disabled={busy} style={button(false)} onClick={() => call('inspect')}>
            Check Google status now
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '0.8125rem', color: '#50575e' }}>Publish this post to request indexing.</div>
      )}

      {error && <div style={{ color: '#d63638', fontSize: '0.8125rem' }}>{error}</div>}
      {result?.steps && (
        <div style={{ fontSize: '0.8125rem' }}>
          {result.steps.map((s: any) => (
            <div key={s.step} style={{ marginBottom: 4 }}>
              {s.status === 'done' ? '✔' : s.status === 'failed' ? '✖' : '•'} <strong>{s.step}:</strong> {s.message}
            </div>
          ))}
          <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={result.inspectLink} target="_blank" rel="noopener noreferrer" style={{ ...button(false), textDecoration: 'none' }} onClick={() => navigator.clipboard?.writeText(result.url).catch(() => undefined)}>
              Open Search Console (URL copied)
            </a>
            <button type="button" style={button(false)} onClick={() => call('request', { manualRequested: true })}>
              I requested indexing in Search Console
            </button>
          </div>
        </div>
      )}

      {data?.channelSubmissions?.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: '#50575e' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>History</div>
          {data.channelSubmissions.map((s: any, i: number) => (
            <div key={i}>
              {new Date(s.requestedAt).toLocaleString()} · {s.channel} · {s.status}
              {s.responseExcerpt ? ` · ${s.responseExcerpt}` : ''}
            </div>
          ))}
        </div>
      )}
      <Link href="/seo-admin/seo/integrations" style={{ fontSize: '0.75rem', color: '#2271b1' }}>
        Manage integrations
      </Link>
    </div>
  );
}
