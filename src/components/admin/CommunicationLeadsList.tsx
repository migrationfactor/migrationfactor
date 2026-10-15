import Link from 'next/link';
import { listCommunicationLeads, type CommunicationLead } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import Filters from './Filters';
import Pagination from './Pagination';
import StatusBadge from './StatusBadge';
import SourceBadge from './SourceBadge';
import { formatDateTime, telHref } from './format';

export const channelPages = {
  whatsapp: { href: '/admin/whatsapp-leads', title: 'WhatsApp leads', intro: 'Visitors who entered their name and number in the website WhatsApp panel.' },
  email: { href: '/admin/email-leads', title: 'Email leads', intro: 'Enquiries sent through the website email form.' },
} as const;

interface Props { channel: CommunicationLead['channel']; q?: string; status?: string; page: number }

/** One row per WhatsApp number or email address; repeat enquiries are listed on the detail page. */
export default async function CommunicationLeadsList({ channel, q, status, page }: Props) {
  const { rows, count } = await listCommunicationLeads(channel, { q, status, page });
  const config = channelPages[channel];
  return (
    <>
      <header className="admin-header"><h1>{config.title}</h1><p>{config.intro}</p></header>
      <Filters q={q} status={status} statuses={leadStatuses} />
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th scope="col">Last enquiry</th><th scope="col">Name</th><th scope="col">Phone</th>{channel === 'email' && <th scope="col">Email</th>}<th scope="col">Topic</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead>
        <tbody>{rows.map((lead) => <tr key={lead.id}>
          <td data-label="Last enquiry">{formatDateTime(lead.last_message_at)}</td>
          <td data-label="Name"><Link href={`${config.href}/${lead.id}`}>{lead.name}</Link></td>
          <td data-label="Phone">{lead.phone ? <a href={telHref(lead.phone)}>{lead.phone}</a> : '—'}</td>
          {channel === 'email' && <td data-label="Email">{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</td>}
          <td data-label="Topic">{lead.topic || '—'}</td>
          <td data-label="Source"><SourceBadge source={channel} /></td>
          <td data-label="Status"><StatusBadge status={lead.status} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">No {channel === 'email' ? 'email' : 'WhatsApp'} leads match these filters.</p>}
      <Pagination page={page} count={count} params={{ q, status }} />
    </>
  );
}
