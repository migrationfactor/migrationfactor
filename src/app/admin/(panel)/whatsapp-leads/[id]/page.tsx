import CommunicationLeadDetail from '@/components/admin/CommunicationLeadDetail';

export const metadata = { title: 'WhatsApp lead' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CommunicationLeadDetail channel="whatsapp" id={id} />;
}
