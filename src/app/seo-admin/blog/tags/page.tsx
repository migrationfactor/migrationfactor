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
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
          Tags
        </h1>
        <p style={{ color: '#3d5557', fontSize: '0.875rem', margin: 0 }}>
          Manage topic tags. Per FR-TAX-002, tag archives default to noindex until they have at least 3 published posts.
        </p>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#e9f3f3', border: '1px solid #d4efec', borderRadius: 8, color: '#07484b', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32 }}>
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #cfe3e3', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            Add New Tag
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#042628', marginBottom: 4 }}>
                Tag Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. TSS 482 Visa"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#042628', marginBottom: 4 }}>
                Slug (Optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. tss-482-visa"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#042628', marginBottom: 4 }}>
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of this tag topic..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem' }}
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

        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #cfe3e3', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f2f8f8', borderBottom: '2px solid #cfe3e3', color: '#3d5557' }}>
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
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#6b8183' }}>No tags created yet.</td></tr>
              ) : (
                tags.map((t) => {
                  const postCount = parseInt(t.post_count || '0', 10);
                  const isIndexable = t.robots_index && postCount >= 3;
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #e9f3f3' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#042628' }}>
                        {t.name}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#3d5557' }}>
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
                            backgroundColor: isIndexable ? '#d4efec' : '#f1e4e4',
                            color: isIndexable ? '#07484b' : '#a01b2b',
                          }}
                        >
                          {isIndexable ? 'Indexable (≥3 posts)' : 'Noindex (<3 posts)'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 10 }}>
                          <Link href={`/blog/tag/${t.slug}/`} target="_blank" style={{ color: '#0b666a', textDecoration: 'none', fontSize: '0.8125rem' }}>
                            View ↗
                          </Link>
                          <button
                            onClick={() => handleDelete(t.id, t.name)}
                            style={{ background: 'none', border: 'none', color: '#b4424f', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
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
