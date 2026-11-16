'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/v1/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          description,
          seoTitle: seoTitle || undefined,
          metaDescription: metaDesc || undefined,
          robotsIndex,
        }),
      });

      if (res.ok) {
        setName('');
        setSlug('');
        setDescription('');
        setSeoTitle('');
        setMetaDesc('');
        setStatusMessage('Category created successfully.');
        loadCategories();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.message || 'Creation failed'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`Are you sure you want to delete category '${catName}'? Its archive URL will 301 redirect to /blog/.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/categories?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage(`Category '${catName}' deleted.`);
        loadCategories();
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
          Categories
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
          Manage hierarchical blog categories, breadcrumb structures, and archive SEO metadata.
        </p>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 8, color: '#0f766e', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32 }}>
        {/* Add Category Form */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            Add New Category
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Category Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Australia Visas"
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
                placeholder="e.g. australia-visas"
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
                placeholder="Category description shown on archive page..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                SEO Title (Optional)
              </label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="e.g. Australia Visa Guides & Pathways"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Meta Description (Optional)
              </label>
              <textarea
                rows={2}
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                placeholder="Meta description for search engines..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="robotsIndexCat"
                checked={robotsIndex}
                onChange={(e) => setRobotsIndex(e.target.checked)}
              />
              <label htmlFor="robotsIndexCat" style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                Allow search engines to index this category archive
              </label>
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
              Add New Category
            </button>
          </form>
        </div>

        {/* Existing Categories Table */}
        <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Name</th>
                <th style={{ padding: '12px 14px' }}>Slug</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Published Posts</th>
                <th style={{ padding: '12px 14px' }}>Robots</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>Loading categories...</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No categories created yet.</td></tr>
              ) : (
                categories.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#042628' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>
                      {c.slug}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0b666a' }}>
                      {c.post_count || 0}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.robots_index ? '#16a34a' : '#dc2626' }}>
                        {c.robots_index ? 'Index' : 'Noindex'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 10 }}>
                        <Link href={`/blog/category/${c.slug}/`} target="_blank" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}>
                          View ↗
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
