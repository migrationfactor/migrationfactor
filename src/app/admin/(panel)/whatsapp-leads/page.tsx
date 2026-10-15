import { requireAdmin } from '@/lib/admin/auth';
import CommunicationLeadsList from '@/components/admin/CommunicationLeadsList';

export const metadata = { title: 'WhatsApp leads' };
type Search = Promise<{ q?: string; status?: string; page?: string }>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const { q, status, page } = await searchParams;
  return <CommunicationLeadsList channel="whatsapp" q={q} status={status} page={Math.max(1, Number(page) || 1)} />;
}
