import { requireAdmin } from '@/lib/admin/auth';
import { listSetupSources } from '@/lib/signatures/service';
import SignSetupForm from '@/components/signatures/SignSetupForm';

export const metadata = { title: 'New signature request' };

export default async function NewSignatureRequestPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const admin = await requireAdmin();
  const { mode } = await searchParams;
  const sources = await listSetupSources();
  return <SignSetupForm mode={mode === 'self' ? 'self' : 'send'} adminEmail={admin.email} documents={sources.documents} templates={sources.templates} />;
}
