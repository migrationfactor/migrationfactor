import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withAdmin } from '@/lib/admin/auth';
import { getRecord, markViewed, type ToolLead } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import { updateLead } from '@/app/admin/actions';
import UpdateForm from '@/components/admin/UpdateForm';
import StatusBadge from '@/components/admin/StatusBadge';
import SourceBadge from '@/components/admin/SourceBadge';
import DetailList from '@/components/admin/DetailList';
import { formatDateTime, statusLabel, telHref } from '@/components/admin/format';

export const metadata = { title: 'Tool lead' };

export default async function ToolLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead] = await withAdmin(Promise.all([getRecord<ToolLead>('tool_leads', id), markViewed('tool_leads', id)]));
  if (!lead) notFound();
  const answers = Object.entries(lead.answers || {});
  return (
    <>
      <Link className="admin-back" href="/admin/tool-leads">← All tool leads</Link>
      <header className="admin-header"><h1>{lead.name}</h1><SourceBadge source="tool" /><StatusBadge status={lead.status} /></header>
      <div className="admin-detail">
        <section className="admin-panel"><h2>Details</h2>
          <DetailList rows={[
            ['Received', formatDateTime(lead.created_at)], ['Tool', lead.tool_name], ['Name', lead.name],
            ['Email', <a key="e" href={`mailto:${lead.email}`}>{lead.email}</a>],
            ['Phone', lead.phone ? <a key="p" href={telHref(lead.phone)}>{lead.phone}</a> : '—'],
            ['Consent', lead.consent ? 'Given' : 'Not given'], ['Team email', statusLabel(lead.notification_status)],
          ]} />
          {lead.message && <><h2>Visitor note</h2><p className="admin-pre">{lead.message}</p></>}
          <h2>Result</h2><p className="admin-pre">{lead.result_summary || '—'}</p>
          {answers.length > 0 && <><h2>Submitted answers</h2><DetailList rows={answers} /></>}
        </section>
        <section className="admin-panel"><h2>Manage</h2><UpdateForm action={updateLead} id={lead.id} table="tool_leads" status={lead.status} notes={lead.admin_notes} statuses={leadStatuses} /></section>
      </div>
    </>
  );
}
