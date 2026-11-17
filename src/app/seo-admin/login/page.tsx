'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SeoAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Login failed.');
        setLoading(false);
        return;
      }

      router.push('/seo-admin');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #042628 0%, #07484b 50%, #0b666a 100%)',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          padding: 40,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: '#0b666a',
              color: '#35b5ac',
              fontSize: '1.75rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            MF
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#042628', margin: '0 0 6px' }}>
            SEO Specialist Portal
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            SEO, GEO & AEO Blog Management System
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: '0.875rem',
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '12px 16px',
              borderRadius: 8,
              background: '#0b666a',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In to SEO Panel'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
          Use your Migration Factor admin email and password. The SEO panel uses the same login as /admin.
        </p>
      </div>
    </div>
  );
}
