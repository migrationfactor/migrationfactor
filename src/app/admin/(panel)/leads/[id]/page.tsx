import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getRecord, type ContactLead } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import { updateLead } from '@/app/admin/actions';
import UpdateForm from '@/components/admin/UpdateForm';
import StatusBadge from '@/components/admin/StatusBadge';
import SourceBadge from '@/components/admin/SourceBadge';
import DetailList from '@/components/admin/DetailList';
import { formatDateTime, statusLabel, telHref } from '@/components/admin/format';

export const metadata = { title: 'Contact lead' };

export default async function ContactLeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const lead = await getRecord<ContactLead>('contact_leads', id);
  if (!lead) notFound();
  return (
    <>
      <Link className="admin-back" href="/admin/leads">← All contact form leads</Link>
      <header className="admin-header"><h1>{lead.name}</h1><SourceBadge source="contact" /><StatusBadge status={lead.status} /></header>
      <div className="admin-detail">
        <section className="admin-panel"><h2>Details</h2>
          <DetailList rows={[
            ['Received', formatDateTime(lead.created_at)], ['Name', lead.name],
            ['Email', <a key="e" href={`mailto:${lead.email}`}>{lead.email}</a>],
            ['Phone', lead.phone ? <a key="p" href={telHref(lead.phone)}>{lead.phone}</a> : '—'],
            ['Service', lead.service || '—'], ['Consent', lead.consent ? 'Given' : 'Not given'],
            ['Team email', statusLabel(lead.notification_status)], ['Last updated', formatDateTime(lead.updated_at)],
          ]} />
          <h2>Message</h2><p className="admin-pre">{lead.message}</p></section>
        <section className="admin-panel"><h2>Manage</h2><UpdateForm action={updateLead} id={lead.id} table="contact_leads" status={lead.status} notes={lead.admin_notes} statuses={leadStatuses} /></section>
      </div>
    </>
  );
}
