import AdminShell from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
