import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getEditorData } from '@/lib/signatures/service';
import FieldEditor from '@/components/signatures/FieldEditor';

export const metadata = { title: 'Place signature fields' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PdfEditorPage({ searchParams }: { searchParams: Promise<{ documentId?: string }> }) {
  await requireAdmin();
  const { documentId = '' } = await searchParams;
  if (!uuid.test(documentId)) notFound();
  const data = await getEditorData(documentId);
  if (!data) notFound();
  const signers = data.requests.filter((r) => r.role === 'signer').map((r) => ({ id: r.id, name: r.signer_name, email: r.signer_email, status: r.status, fields: r.fields }));
  return <FieldEditor documentId={data.document.id} documentName={data.document.name} pdfUrl={data.url} signers={signers} selfSign={data.document.self_sign} />;
}
