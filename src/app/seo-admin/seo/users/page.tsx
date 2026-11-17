'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DataTable, PageHeader } from '@/components/seo-admin/DataTable';

const ROLE_HELP: Record<string, string> = {
  super_admin: 'Everything, including integrations and permalinks',
  admin: 'Posts, SEO, redirects, media and users (not robots.txt or integrations)',
  seo_manager: 'All SEO, schema, redirects and robots.txt',
  editor: 'Write, publish and manage content',
  author: 'Write own drafts and submit for review',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/users');
    if (!res.ok) {
      setMessage('Error: you do not have permission to manage users.');
      return;
    }
    const data = await res.json();
    setUsers(data.users);
    setRoles(data.roles);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, patch: { role?: string; status?: string }) => {
    const res = await fetch('/api/v1/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
    const data = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Saved.' : 'Error: ' + (data.message || 'Could not save.'));
    await load();
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader
        title="Users & Roles"
        subtitle="Everyone signs in with the main admin login. A person appears here after opening the SEO panel for the first time; set what they may do inside it."
      />
      {message && (
        <div style={{ padding: '10px 16px', background: message.startsWith('Error') ? '#f1e4e4' : '#e9f3f3', border: '1px solid ' + (message.startsWith('Error') ? '#e3c3c7' : '#d4efec'), borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>
          {message}
        </div>
      )}
      <DataTable
        empty="No users yet."
        rows={users}
        columns={[
          { key: 'email', label: 'Email' },
          {
            key: 'role',
            label: 'Role',
            render: (u) => (
              <select
                value={u.roles[0] || ''}
                onChange={(e) => update(u.id, { role: e.target.value })}
                title={ROLE_HELP[u.roles[0]] || ''}
                style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #b9d3d4', background: '#fff' }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ),
          },
          { key: 'help', label: 'Can do', render: (u) => ROLE_HELP[u.roles[0]] || 'No role' },
          { key: 'last_login_at', label: 'Last seen', render: (u) => (u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—') },
          {
            key: 'status',
            label: 'Access',
            render: (u) => (
              <button
                type="button"
                onClick={() => update(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #b9d3d4', background: u.status === 'active' ? '#ffffff' : '#f1e4e4', color: u.status === 'active' ? '#042628' : '#a01b2b', fontWeight: 600, cursor: 'pointer' }}
              >
                {u.status === 'active' ? 'Active – disable' : 'Disabled – enable'}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
