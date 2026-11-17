'use client';

import React, { useEffect, useState } from 'react';
import { DataTable, PageHeader } from '@/components/seo-admin/DataTable';

export default function AuditLogPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');

  const load = async (filter: string) => {
    setError('');
    const res = await fetch(`/api/v1/audit-logs?limit=100${filter ? `&action=${encodeURIComponent(filter)}` : ''}`);
    if (!res.ok) {
      setError('You do not have permission to view the audit log.');
      return;
    }
    setRows(await res.json());
  };

  useEffect(() => {
    load('');
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader title="Audit Log" subtitle="Append-only record of content, SEO, redirect, robots and login changes (SEC-09)." />
      {error && <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(action);
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filter by action, e.g. post.publish"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
        />
        <button type="submit" style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0b666a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Filter
        </button>
      </form>
      <DataTable
        empty="No audit entries match."
        rows={rows}
        columns={[
          { key: 'created_at', label: 'When', render: (r) => new Date(r.created_at).toLocaleString() },
          { key: 'action', label: 'Action' },
          { key: 'entity_type', label: 'Entity', render: (r) => `${r.entity_type}${r.entity_id ? ' ' + String(r.entity_id).slice(0, 8) : ''}` },
          { key: 'actor_role', label: 'Role' },
          {
            key: 'diff',
            label: 'Before → After',
            render: (r) => (
              <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {JSON.stringify(r.before ?? null).slice(0, 80)} → {JSON.stringify(r.after ?? null).slice(0, 80)}
              </code>
            ),
          },
        ]}
      />
    </div>
  );
}
