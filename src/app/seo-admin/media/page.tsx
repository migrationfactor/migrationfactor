'use client';

import React, { useState, useEffect } from 'react';

export default function MediaLibraryAdminPage() {
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingAlt, setMissingAlt] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const loadMedia = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (missingAlt) query.set('missing_alt', 'true');
      if (search) query.set('q', search);

      const res = await fetch(`/api/v1/media?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMediaList(data.media || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [missingAlt]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setStatusMessage('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('alt_text', altText);
    formData.append('title', title);
    formData.append('caption', caption);

    try {
      const res = await fetch('/api/v1/media', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setStatusMessage('Image uploaded and optimized successfully.');
        setSelectedFile(null);
        setAltText('');
        setTitle('');
        setCaption('');
        loadMedia();
      } else {
        const err = await res.json();
        setStatusMessage(`Upload failed: ${err.message || 'Error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;

    try {
      const res = await fetch(`/api/v1/media/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`Deleted '${name}'.`);
        loadMedia();
      } else {
        alert(data.message || 'Could not delete media.');
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1d2327', margin: '0 0 4px' }}>
            Media Library & Image SEO
          </h1>
          <p style={{ color: '#50575e', fontSize: '0.875rem', margin: 0 }}>
            Manage media assets, enforce alt text, and track usage across articles.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#f0f0f1', border: '1px solid #f0f6fc', borderRadius: 8, color: '#135e96', marginBottom: 20, fontSize: '0.875rem' }}>
          {statusMessage}
        </div>
      )}

      {/* Upload Box */}
      <div style={{ background: '#ffffff', padding: 20, borderRadius: 12, border: '1px solid #c3c4c7', marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1d2327', margin: '0 0 12px' }}>
          Upload New Image
        </h2>
        <form onSubmit={handleUpload} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
              Select File (JPEG, PNG, WebP, AVIF)
            </label>
            <input
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
              Alt Text * (Required for SEO)
            </label>
            <input
              type="text"
              required
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descriptive text for accessibility"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#1d2327', marginBottom: 4 }}>
              Title / Caption (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Image title"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #8c8f94', fontSize: '0.85rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            style={{
              padding: '9px 16px',
              backgroundColor: '#2271b1',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Processing & Generating Crops...' : 'Upload & Optimize'}
          </button>
        </form>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <button
          onClick={() => setMissingAlt(false)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: !missingAlt ? '#1d2327' : '#c3c4c7',
            color: !missingAlt ? '#ffffff' : '#50575e',
          }}
        >
          All Images
        </button>
        <button
          onClick={() => setMissingAlt(true)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: missingAlt ? '#d63638' : '#fcf0f1',
            color: missingAlt ? '#ffffff' : '#8a2424',
          }}
        >
          ⚠️ Missing Alt Text
        </button>
      </div>

      {/* Images Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#50575e' }}>Loading media assets...</div>
      ) : mediaList.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#ffffff', borderRadius: 12, color: '#787c82' }}>
          No images found.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {mediaList.map((m) => (
            <div
              key={m.id}
              style={{
                background: '#ffffff',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid #c3c4c7',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ width: '100%', height: 160, backgroundColor: '#f0f0f1', position: 'relative' }}>
                <img
                  src={m.url}
                  alt={m.alt_text || 'Media preview'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {!m.alt_text && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: '#d63638',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    NO ALT
                  </div>
                )}
              </div>
              <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1d2327', marginBottom: 4, wordBreak: 'break-all' }}>
                  {m.title || m.filename}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#50575e', marginBottom: 8 }}>
                  {m.width} x {m.height} px · {Math.round(m.file_size / 1024)} KB
                </div>
                {m.alt_text && (
                  <div style={{ fontSize: '0.75rem', color: '#2271b1', fontStyle: 'italic', marginBottom: 8 }}>
                    Alt: "{m.alt_text}"
                  </div>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f1', paddingTop: 10 }}>
                  <span style={{ fontSize: '0.75rem', color: '#787c82' }}>
                    Used in: {m.usage_count || 0} post(s)
                  </span>
                  <button
                    onClick={() => handleDelete(m.id, m.filename)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#d63638',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
