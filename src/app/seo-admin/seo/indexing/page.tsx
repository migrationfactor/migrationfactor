'use client';

import React, { useEffect, useState } from 'react';
import { DataTable, PageHeader } from '@/components/seo-admin/DataTable';

export default function IndexingPage() {
  const [sitemap, setSitemap] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [s, h] = await Promise.all([fetch('/api/v1/sitemaps'), fetch('/api/v1/indexing/history')]);
      if (!s.ok || !h.ok) {
        setError('You do not have permission to view indexing data.');
        return;
      }
      setSitemap(await s.json());
      setHistory(await h.json());
    })();
  }, []);

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader title="Sitemaps & Indexing" subtitle="Submission history per channel. A submission is a hint only: it never guarantees crawling, indexing, rich results or rankings." />
      {error && <div style={{ padding: 12, background: '#f1e4e4', color: '#a01b2b', borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      {sitemap && (
        <div style={{ background: '#fff', padding: 20, borderRadius: 12, border: '1px solid #cfe3e3', marginBottom: 24, fontSize: '0.875rem' }}>
          <p style={{ margin: '0 0 6px' }}>
            Sitemap index:{' '}
            <a href={sitemap.index} target="_blank" rel="noopener noreferrer" style={{ color: '#0b666a', fontWeight: 600 }}>
              {sitemap.index}
            </a>
          </p>
          <p style={{ margin: '0 0 6px' }}>
            {sitemap.files[0]?.urls ?? 0} indexable posts listed · {sitemap.excludedPublishedPosts} published posts excluded (noindex or manually excluded)
          </p>
          <p style={{ margin: 0, color: '#3d5557' }}>{sitemap.note}</p>
        </div>
      )}
      <DataTable
        empty="No submissions yet. IndexNow notifications appear here after you request indexing on a published post."
        rows={history}
        columns={[
          { key: 'requested_at', label: 'When', render: (r) => new Date(r.requested_at).toLocaleString() },
          { key: 'channel', label: 'Channel' },
          { key: 'action', label: 'Action' },
          { key: 'url', label: 'URL' },
          { key: 'status', label: 'Status' },
          { key: 'response_code', label: 'HTTP' },
        ]}
      />
    </div>
  );
}
