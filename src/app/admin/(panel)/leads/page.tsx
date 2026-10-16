import Link from 'next/link';
import { withAdmin } from '@/lib/admin/auth';
import { listContactLeads, markSectionSeen } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import Filters from '@/components/admin/Filters';
import Pagination from '@/components/admin/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import UnreadDot from '@/components/admin/UnreadDot';
import ReadMore from '@/components/admin/ReadMore';
import SourceBadge from '@/components/admin/SourceBadge';
import { formatDateTime, telHref } from '@/components/admin/format';

export const metadata = { title: 'Contact leads' };
type Search = Promise<{ q?: string; status?: string; page?: string }>;

export default async function ContactLeadsPage({ searchParams }: { searchParams: Search }) {
  const { q, status, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const [{ rows, count }] = await withAdmin(Promise.all([listContactLeads({ q, status, page }), markSectionSeen('contact')]));
  return (
    <>
      <header className="admin-header"><h1>Contact form leads</h1><p>Submissions from the contact and enquiry forms.</p></header>
      <Filters q={q} status={status} statuses={leadStatuses} />
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th scope="col">Received</th><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Service</th><th scope="col">Message</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead>
        <tbody>{rows.map((lead) => <tr key={lead.id} className={lead.viewed_at ? undefined : 'admin-row-unread'}>
          <td data-label="Received">{formatDateTime(lead.created_at)}</td>
          <td data-label="Name"><UnreadDot viewedAt={lead.viewed_at} /><Link href={`/admin/leads/${lead.id}`}>{lead.name}</Link></td>
          <td data-label="Email"><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
          <td data-label="Phone">{lead.phone ? <a href={telHref(lead.phone)}>{lead.phone}</a> : '—'}</td>
          <td data-label="Service">{lead.service || '—'}</td>
          <td data-label="Message" className="admin-cell-long"><ReadMore text={lead.message} /></td>
          <td data-label="Source"><SourceBadge source="contact" /></td>
          <td data-label="Status"><StatusBadge status={lead.status} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">No contact leads match these filters.</p>}
      <Pagination page={page} count={count} params={{ q, status }} />
    </>
  );
}
