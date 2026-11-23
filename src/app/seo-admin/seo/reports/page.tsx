'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { DataTable, PageHeader, Tabs } from '@/components/seo-admin/DataTable';

export default function SeoReportsPage() {
  const [links, setLinks] = useState<{ orphans: any[]; broken: any[]; redirected: any[] }>({ orphans: [], broken: [], redirected: [] });
  const [notFound, setNotFound] = useState<any[]>([]);
  const [tab, setTab] = useState('orphans');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [l, n] = await Promise.all([fetch('/api/v1/links/report'), fetch('/api/v1/404s')]);
        if (!l.ok || !n.ok) throw new Error('You do not have permission to view SEO reports.');
        setLinks(await l.json());
        setNotFound(await n.json());
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  const postLink = (row: any) => (
    <Link href={`/seo-admin/blog/${row.source_post_id ?? row.id}`} style={{ color: '#2271b1', fontWeight: 600 }}>
      {row.source_title ?? row.title}
    </Link>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHeader
        title="SEO Reports"
        subtitle="Orphan posts, broken or redirected internal links and 404 hits (last 90 days). These checks guide editors; they do not guarantee rankings."
      />
      {error && <div style={{ padding: 12, background: '#fcf0f1', color: '#d63638', borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'orphans', label: 'Orphan posts', count: links.orphans.length },
          { id: 'broken', label: 'Broken internal links', count: links.broken.length },
          { id: 'redirected', label: 'Links to redirects', count: links.redirected.length },
          { id: '404', label: '404 monitor', count: notFound.length },
        ]}
      />
      {tab === 'orphans' && (
        <DataTable
          empty="No orphan posts. Every published post has an incoming internal link."
          rows={links.orphans}
          columns={[
            { key: 'title', label: 'Post', render: postLink },
            { key: 'slug', label: 'URL', render: (r) => `/blog/${r.slug}/` },
          ]}
        />
      )}
      {tab === 'broken' && (
        <DataTable
          empty="No broken internal links."
          rows={links.broken}
          columns={[
            { key: 'source_title', label: 'Source post', render: postLink },
            { key: 'target_url', label: 'Links to' },
            { key: 'anchor_text', label: 'Anchor' },
            { key: 'target_status', label: 'Target status', render: (r) => r.target_status || 'HTTP error' },
          ]}
        />
      )}
      {tab === 'redirected' && (
        <DataTable
          empty="No internal links point to redirected URLs."
          rows={links.redirected}
          columns={[
            { key: 'source_title', label: 'Source post', render: postLink },
            { key: 'target_url', label: 'Current link' },
            { key: 'final_url', label: 'Update to' },
          ]}
        />
      )}
      {tab === '404' && (
        <DataTable
          empty="No 404 hits recorded."
          rows={notFound.map((r, i) => ({ ...r, id: i }))}
          columns={[
            { key: 'path', label: 'Path' },
            { key: 'hits', label: 'Hits' },
            { key: 'first_seen', label: 'First seen', render: (r) => String(r.first_seen).slice(0, 10) },
            { key: 'last_seen', label: 'Last seen', render: (r) => String(r.last_seen).slice(0, 10) },
            {
              key: 'act',
              label: 'Action',
              render: (r) => (
                <Link href="/seo-admin/seo/redirects" style={{ color: '#2271b1', fontWeight: 600 }}>
                  Create redirect
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
