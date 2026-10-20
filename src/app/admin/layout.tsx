import type { Metadata } from 'next';
import '@/styles/admin.css';
import '@/styles/signing.css';

export const metadata: Metadata = {
  title: { template: '%s | Admin', default: 'Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
