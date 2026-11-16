'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AuthorsAdminPage() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [jobTitle, setJobTitle] = useState('Registered Migration Specialist');
  const [shortBio, setShortBio] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadAuthors = async () => {
    try {
      const res = await fetch('/api/v1/authors');
      if (res.ok) {
        const data = await res.json();
        setAuthors(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuthors();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage('');

    const sameAs = linkedInUrl ? [linkedInUrl.trim()] : [];
    const credentials = credentialName ? [{ name: credentialName.trim(), issuingBody: 'OMARA / Migration Institute of Australia' }] : [];

    try {
      const res = await fetch('/api/v1/authors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          slug: slug || undefined,
          jobTitle,
          shortBio,
          sameAs,
          credentials,
        }),
      });

      if (res.ok) {
        setDisplayName('');
        setSlug('');
        setShortBio('');
        setLinkedInUrl('');
        setCredentialName('');
        setStatusMessage('Author profile created successfully.');
        loadAuthors();
      } else {
        const data = await res.json();
        setStatusMessage(`Error: ${data.message || 'Creation failed'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
          Author Profiles (E-E-A-T & Person Schema)
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
          Manage verifiable authorship and credentials per FR-TAX-003 and Google E-E-A-T guidelines.
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
            Add New Author Profile
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Display Name *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ayesha Khan"
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
                placeholder="e.g. ayesha-khan"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Professional Job Title *
              </label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Registered Migration Agent"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Short Bio (50–600 chars, E-E-A-T)
              </label>
              <textarea
                rows={3}
                value={shortBio}
                onChange={(e) => setShortBio(e.target.value)}
                placeholder="Specializes in Australian employer nomination and skilled visa pathways..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Primary Qualification / Credential
              </label>
              <input
                type="text"
                value={credentialName}
                onChange={(e) => setCredentialName(e.target.value)}
                placeholder="e.g. Graduate Certificate in Australian Migration Law"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                LinkedIn or Official Profile URL
              </label>
              <input
                type="url"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/..."
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
              Add Author Profile
            </button>
          </form>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Author Name</th>
                <th style={{ padding: '12px 14px' }}>Job Title</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Published Articles</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' }}>Loading authors...</td></tr>
              ) : authors.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No authors registered yet.</td></tr>
              ) : (
                authors.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#042628' }}>
                      {a.display_name}
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                        /blog/author/{a.slug}/
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {a.job_title || 'Migration Specialist'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0b666a' }}>
                      {a.post_count || 0}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <Link href={`/blog/author/${a.slug}/`} target="_blank" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}>
                        View Profile ↗
                      </Link>
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
