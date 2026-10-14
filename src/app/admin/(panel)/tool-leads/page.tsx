import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { listToolLeads } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import { allTools } from '@/features/immigration-tools/catalog';
import Filters from '@/components/admin/Filters';
import Pagination from '@/components/admin/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import { formatDateTime } from '@/components/admin/format';

export const metadata = { title: 'Tool leads' };
type Search = Promise<{ q?: string; status?: string; tool?: string; page?: string }>;
const toolOptions: [string, string][] = [
  ['', 'All tools'],
  ['visa-assessment', 'Visa Assessment (homepage)'],
  ...allTools.map((tool) => [tool.slug, tool.name] as [string, string]),
];

export default async function ToolLeadsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const { q, status, tool, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const { rows, count } = await listToolLeads({ q, status, tool, page });
  return (
    <>
      <header className="admin-header"><h1>Tool leads</h1><p>Visitors who sent a migration or visa tool result to the team.</p></header>
      <Filters q={q} status={status} statuses={leadStatuses} extra={{ name: 'tool', label: 'Tool', value: tool, options: toolOptions }} />
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th scope="col">Received</th><th scope="col">Tool</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead>
        <tbody>{rows.map((lead) => <tr key={lead.id}>
          <td data-label="Received">{formatDateTime(lead.created_at)}</td>
          <td data-label="Tool">{lead.tool_name}</td>
          <td data-label="Name"><Link href={`/admin/tool-leads/${lead.id}`}>{lead.name}</Link></td>
          <td data-label="Email"><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
          <td data-label="Phone">{lead.phone || '—'}</td>
          <td data-label="Result" className="admin-clip">{lead.result_summary || '—'}</td>
          <td data-label="Status"><StatusBadge status={lead.status} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">No tool leads match these filters.</p>}
      <Pagination page={page} count={count} params={{ q, status, tool }} />
    </>
  );
}
