import AdminShell from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin/auth';
import { newLeadCounts } from '@/lib/admin/queries';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email} counts={await newLeadCounts()}>{children}</AdminShell>;
}
