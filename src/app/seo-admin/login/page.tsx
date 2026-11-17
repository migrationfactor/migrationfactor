'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
    <div className="admin-login">
      <div className="admin-login-card">
        <Image src="/brand/mark.webp" width={72} height={72} alt="Migration Factor" priority />
        <h1>SEO admin sign in</h1>
        <p>SEO, GEO &amp; AEO blog management. Authorised Migration Factor staff only.</p>
        {error && <p className="admin-message error" role="alert">{error}</p>}
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="admin-button" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
