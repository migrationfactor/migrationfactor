import AdminShell from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin/auth';
import { newLeadCounts } from '@/lib/admin/queries';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Both run at once; the counts query is admin-only in the database and falls back to zero.
  const [admin, counts] = await Promise.all([requireAdmin(), newLeadCounts()]);
  return <AdminShell email={admin.email} counts={counts}>{children}</AdminShell>;
}
