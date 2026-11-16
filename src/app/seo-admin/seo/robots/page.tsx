'use client';

import React, { useState, useEffect } from 'react';

export default function RobotsTxtAdminPage() {
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadRobots = async () => {
    try {
      const res = await fetch('/api/v1/robots-txt');
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || '');
        setVersions(data.versions || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRobots();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (content.includes('Disallow: /') && !content.includes('Disallow: /seo-admin/')) {
      if (!confirm('WARNING: Your robots.txt appears to contain "Disallow: /" which blocks search engines from crawling the entire site! Are you sure you want to save this?')) {
        return;
      }
    }

    setSaving(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/robots-txt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, note: note || 'Admin update' }),
      });

      if (res.ok) {
        setStatusMessage('Active robots.txt saved and versioned.');
        setNote('');
        loadRobots();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.message || 'Save failed'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
            Robots.txt Editor & Crawler Directives
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
            Direct search engine crawlers and AI bots per FR-TEC-007, 008 with version history.
          </p>
        </div>
        <a
          href="/robots.txt"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '8px 14px',
            backgroundColor: '#042628',
            color: '#ffffff',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          View Live /robots.txt ↗
        </a>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 8, color: '#0f766e', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        <form onSubmit={handleSave} style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#042628', marginBottom: 8 }}>
            Robots.txt File Contents
          </label>
          <textarea
            rows={16}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: '100%',
              padding: 14,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              lineHeight: 1.5,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Version Change Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Added crawler directive for AI search engines"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#0b666a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving & Publishing...' : 'Save & Publish Robots.txt'}
            </button>
          </div>
        </form>

        {/* Version History Sidebar */}
        <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#042628', margin: '0 0 14px' }}>
            Revision History
          </h2>
          {versions.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No saved history yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {versions.map((v) => (
                <div key={v.id} style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 600, color: '#042628' }}>{v.note || 'Edit'}</div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 2 }}>
                    {new Date(v.created_at).toLocaleString('en-AU')}
                  </div>
                  {v.created_by_name && (
                    <div style={{ color: '#0b666a', fontSize: '0.75rem', marginTop: 2 }}>
                      By {v.created_by_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
