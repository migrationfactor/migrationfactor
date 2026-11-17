import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySeoSession } from '@/lib/seo-system/auth';
import SeoAdminNav from '@/components/seo-admin/SeoAdminNav';
import '@/styles/admin.css';
import '@/styles/seo-admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { template: '%s | SEO Admin', default: 'SEO Admin' },
  robots: { index: false, follow: false },
};

export default async function SeoAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySeoSession();
  const user: any = session ? session.user : null;

  // Signed-out visitors may only see the login page (it shares the main admin login).
  if (!user) {
    const path = (await headers()).get('x-pathname') || '';
    if (path !== '/seo-admin/login') redirect('/seo-admin/login');
    return <div className="admin-root seo-admin">{children}</div>;
  }

  return (
    <div className="admin-root seo-admin">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="admin-brand" href="/seo-admin" aria-label="SEO admin dashboard">
            <Image src="/brand/mark.webp" width={56} height={56} alt="" />
            <span>SEO Admin</span>
          </Link>
          <SeoAdminNav />
          <div className="admin-account">
            <span title={user.display_name}>{user.display_name}</span>
            {user.roles?.length ? <small className="admin-account-role">{user.roles.join(', ')}</small> : null}
            <form action="/api/v1/auth/logout" method="POST">
              <button type="submit" className="admin-link-button">Sign out</button>
            </form>
            <Link href="/" className="admin-site-link">View website ↗</Link>
          </div>
        </aside>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
