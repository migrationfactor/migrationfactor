import { requireAdmin } from '@/lib/admin/auth';
import CommunicationLeadDetail from '@/components/admin/CommunicationLeadDetail';

export const metadata = { title: 'WhatsApp lead' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return <CommunicationLeadDetail channel="whatsapp" id={id} />;
}
