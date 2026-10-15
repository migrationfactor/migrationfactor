import Link from 'next/link';
import Image from 'next/image';
import { signOut } from '@/app/admin/actions';
import AdminNav from './AdminNav';
import type { NewLeadCounts } from '@/lib/admin/queries';

export default function AdminShell({ email, counts, children }: { email: string; counts: NewLeadCounts; children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin" aria-label="Admin dashboard">
          <Image src="/brand/mark.webp" width={56} height={56} alt="" />
          <span>Admin</span>
        </Link>
        <AdminNav initialCounts={counts} />
        <div className="admin-account">
          <span title={email}>{email}</span>
          <form action={signOut}><button type="submit" className="admin-link-button">Sign out</button></form>
          <Link href="/" className="admin-site-link">View website ↗</Link>
        </div>
      </aside>
      <div className="admin-content">{children}</div>
    </div>
  );
}
