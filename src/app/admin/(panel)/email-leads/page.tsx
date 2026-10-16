import CommunicationLeadsList from '@/components/admin/CommunicationLeadsList';

export const metadata = { title: 'Email leads' };
type Search = Promise<{ q?: string; status?: string; page?: string }>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const { q, status, page } = await searchParams;
  return <CommunicationLeadsList channel="email" q={q} status={status} page={Math.max(1, Number(page) || 1)} />;
}
