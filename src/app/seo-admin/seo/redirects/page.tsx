'use client';

import React, { useState, useEffect } from 'react';

export default function RedirectsAdminPage() {
  const [redirects, setRedirects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourcePath, setSourcePath] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [httpCode, setHttpCode] = useState(301);
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadRedirects = async () => {
    try {
      const res = await fetch('/api/v1/redirects');
      if (res.ok) {
        const data = await res.json();
        setRedirects(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRedirects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');

    try {
      const res = await fetch('/api/v1/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath,
          targetUrl,
          httpCode: Number(httpCode),
          notes,
        }),
      });

      if (res.ok) {
        setSourcePath('');
        setTargetUrl('');
        setNotes('');
        setStatusMessage('Redirect created successfully.');
        loadRedirects();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.message || 'Creation failed'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string, source: string) => {
    if (!confirm(`Delete redirect for '${source}'?`)) return;

    try {
      const res = await fetch(`/api/v1/redirects?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setStatusMessage(`Deleted redirect for '${source}'.`);
        loadRedirects();
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1d2327', margin: '0 0 4px' }}>
          URL Redirects (301 Single Hop)
        </h1>
        <p style={{ color: '#50575e', fontSize: '0.875rem', margin: 0 }}>
          Manage redirects per FR-TEC-010 with automatic chain/loop prevention and hit tracking.
        </p>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#f0f0f1', border: '1px solid #f0f6fc', borderRadius: 8, color: '#135e96', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32 }}>
        {/* Add Redirect Form */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, border: '1px solid #c3c4c7', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d2327', margin: '0 0 16px' }}>
            Add New Redirect Rule
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
                Source Path (Relative) *
              </label>
              <input
                type="text"
                required
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/blog/old-slug/"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
                Target URL (Relative or Absolute) *
              </label>
              <input
                type="text"
                required
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="/blog/new-slug/ or https://..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
                HTTP Status Code
              </label>
              <select
                value={httpCode}
                onChange={(e) => setHttpCode(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.875rem', background: '#ffffff' }}
              >
                <option value={301}>301 Permanent Redirect (Default)</option>
                <option value={302}>302 Temporary Redirect</option>
                <option value={307}>307 Temporary Redirect (Strict)</option>
                <option value={308}>308 Permanent Redirect (Strict)</option>
                <option value={410}>410 Content Gone</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
                Note / Reason
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Updated article URL for better keyword relevance"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.875rem' }}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: '10px 16px',
                borderRadius: 6,
                backgroundColor: '#2271b1',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Save Redirect Rule
            </button>
          </form>
        </div>

        {/* Existing Redirects */}
        <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #c3c4c7', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f6f7f7', borderBottom: '2px solid #c3c4c7', color: '#50575e' }}>
                <th style={{ padding: '12px 16px' }}>Source Path</th>
                <th style={{ padding: '12px 14px' }}>Target URL</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Type</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Hits</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>Loading redirects...</td></tr>
              ) : redirects.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#787c82' }}>No redirects configured yet.</td></tr>
              ) : (
                redirects.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f0f0f1' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#d63638', fontWeight: 600 }}>
                      {r.source_path}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#2271b1' }}>
                      {r.target_url}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#50575e' }}>
                      {r.http_code}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#1d2327' }}>
                      {r.hits || 0}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(r.id, r.source_path)}
                        style={{ background: 'none', border: 'none', color: '#d63638', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                      >
                        Delete
                      </button>
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
