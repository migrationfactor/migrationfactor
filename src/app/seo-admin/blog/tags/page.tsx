'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TagsAdminPage() {
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const loadTags = async () => {
    try {
      const res = await fetch('/api/v1/tags');
      if (res.ok) {
        const data = await res.json();
        setTags(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          description,
          robotsIndex,
        }),
      });

      if (res.ok) {
        setName('');
        setSlug('');
        setDescription('');
        setStatusMessage('Tag created successfully.');
        loadTags();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.message || 'Creation failed'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, tagName: string) => {
    if (!confirm(`Delete tag '${tagName}'?`)) return;

    try {
      const res = await fetch(`/api/v1/tags?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage(`Tag '${tagName}' deleted.`);
        loadTags();
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
          Tags
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
          Manage topic tags. Per FR-TAX-002, tag archives default to noindex until they have at least 3 published posts.
        </p>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 8, color: '#0f766e', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32 }}>
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            Add New Tag
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Tag Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TSS 482 Visa"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Slug (Optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. tss-482-visa"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this tag topic..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: '10px 16px',
                borderRadius: 6,
                backgroundColor: '#0b666a',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Add New Tag
            </button>
          </form>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Name</th>
                <th style={{ padding: '12px 14px' }}>Slug</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Published Posts</th>
                <th style={{ padding: '12px 14px' }}>Indexability</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>Loading tags...</td></tr>
              ) : tags.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No tags created yet.</td></tr>
              ) : (
                tags.map((t) => {
                  const postCount = parseInt(t.post_count || '0', 10);
                  const isIndexable = t.robots_index && postCount >= 3;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#042628' }}>
                        {t.name}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>
                        {t.slug}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0b666a' }}>
                        {postCount}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: isIndexable ? '#dcfce7' : '#fee2e2',
                            color: isIndexable ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {isIndexable ? 'Indexable (≥3 posts)' : 'Noindex (<3 posts)'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 10 }}>
                          <Link href={`/blog/tag/${t.slug}/`} target="_blank" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}>
                            View ↗
                          </Link>
                          <button
                            onClick={() => handleDelete(t.id, t.name)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
