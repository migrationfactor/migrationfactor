'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SITE_NAME, initials } from '@/lib/seo-system/site-config';

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
    <div className="sa-login">
      <h1 className="sa-login-logo"><span>{initials(SITE_NAME)}</span>{SITE_NAME} SEO</h1>
      <div className="sa-login-box">
        {error && <div className="sa-notice sa-notice-error" role="alert"><p>{error}</p></div>}
        <form onSubmit={handleSubmit}>
          <p>
            <label htmlFor="sa-email">Email Address</label>
            <input id="sa-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          </p>
          <p>
            <label htmlFor="sa-pass">Password</label>
            <input id="sa-pass" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
          </p>
          <p className="sa-login-submit">
            <button type="submit" className="button button-primary" disabled={loading}>{loading ? 'Logging in…' : 'Log In'}</button>
          </p>
        </form>
      </div>
      <p className="sa-login-note">Use your admin email and password.</p>
    </div>
  );
}
