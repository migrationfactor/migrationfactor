import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySeoSession } from '@/lib/seo-system/auth';
import SeoAdminChrome from '@/components/seo-admin/SeoAdminChrome';
import '@/styles/seo-admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { template: '%s | SEO Admin', default: 'SEO Admin' },
  robots: { index: false, follow: false },
};

export default async function SeoAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySeoSession();
  const user: any = session ? session.user : null;

  // Signed-out visitors may only see the login page (it shares the main admin login).
  if (!user) {
    const path = (await headers()).get('x-pathname') || '';
    if (path !== '/seo-admin/login') redirect('/seo-admin/login');
    return <div className="sa-root sa-login-root">{children}</div>;
  }

  return (
    <SeoAdminChrome name={user.display_name} roles={(user.roles || []).join(', ')}>
      {children}
    </SeoAdminChrome>
  );
}
