import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { verifySeoSession } from '@/lib/seo-system/auth';

export const dynamic = 'force-dynamic';

export default async function SeoAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('seo_session_token')?.value;

  let user: any = null;
  if (sessionToken) {
    const session = await verifySeoSession(sessionToken);
    if (session) {
      user = session.user;
    }
  }

  // If user is not logged in, render the login/child content without the admin chrome
  if (!user) {
    return <div style={{ minHeight: '100vh', background: '#f8fafc' }}>{children}</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1f2937', background: '#f1f5f9' }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: 250,
          background: '#042628',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Brand / Logo */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #07484b', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#0b666a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#35b5ac',
              fontSize: '1.2rem',
            }}
          >
            MF
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff' }}>SEO Specialist</div>
            <div style={{ fontSize: '0.75rem', color: '#35b5ac' }}>Migration Factor</div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', padding: '8px 12px 4px', fontWeight: 700 }}>
            Core
          </div>
          <Link
            href="/seo-admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            📊 Dashboard
          </Link>

          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 4px', fontWeight: 700 }}>
            Editorial
          </div>
          <Link
            href="/seo-admin/blog"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            📝 All Posts
          </Link>
          <Link
            href="/seo-admin/blog/new"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            ➕ Add New Post
          </Link>
          <Link
            href="/seo-admin/blog/categories"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            📁 Categories
          </Link>
          <Link
            href="/seo-admin/blog/tags"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🏷️ Tags
          </Link>
          <Link
            href="/seo-admin/blog/authors"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            ✍️ Authors
          </Link>

          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', padding: '16px 12px 4px', fontWeight: 700 }}>
            Assets & Engine
          </div>
          <Link
            href="/seo-admin/media"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🖼️ Media Library
          </Link>
          <Link
            href="/seo-admin/seo/redirects"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🔀 Redirects (301)
          </Link>
          <Link
            href="/seo-admin/seo/robots"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🤖 Robots.txt
          </Link>
          <a
            href="/sitemap_index.xml"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              borderRadius: 6,
              color: '#f8fafc',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            🗺️ XML Sitemap ↗
          </a>
        </nav>

        {/* User Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #07484b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff' }}>{user.display_name}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{user.roles?.join(', ')}</div>
          </div>
          <form action="/api/v1/auth/logout" method="POST">
            <button
              type="submit"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        <main style={{ flex: 1, padding: 32 }}>{children}</main>
      </div>
    </div>
  );
}
