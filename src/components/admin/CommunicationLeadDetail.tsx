import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withAdmin } from '@/lib/admin/auth';
import { getRecord, listCommunicationMessages, markViewed, type CommunicationLead } from '@/lib/admin/queries';
import { leadStatuses } from '@/lib/leads/validation';
import { updateLead } from '@/app/admin/actions';
import UpdateForm from './UpdateForm';
import StatusBadge from './StatusBadge';
import SourceBadge from './SourceBadge';
import DetailList from './DetailList';
import { channelPages } from './CommunicationLeadsList';
import { formatDateTime, statusLabel, telHref } from './format';

/** WhatsApp link to the visitor's own number. Numbers without a country code are treated as Australian. */
function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${phone.trim().startsWith('+') ? digits : digits.replace(/^0/, '61')}`;
}

export default async function CommunicationLeadDetail({ channel, id }: { channel: CommunicationLead['channel']; id: string }) {
  const [lead, messages] = await withAdmin(Promise.all([getRecord<CommunicationLead>('communication_leads', id), listCommunicationMessages(id), markViewed('communication_leads', id)]));
  if (!lead || lead.channel !== channel) notFound();
  const config = channelPages[channel];
  return (
    <>
      <Link className="admin-back" href={config.href}>← All {config.title.toLowerCase()}</Link>
      <header className="admin-header"><h1>{lead.name}</h1><SourceBadge source={channel} /><StatusBadge status={lead.status} /></header>
      <div className="admin-detail">
        <section className="admin-panel"><h2>Details</h2>
          <DetailList rows={[
            ['First enquiry', formatDateTime(lead.created_at)], ['Last enquiry', formatDateTime(lead.last_message_at)], ['Name', lead.name],
            ['Phone', lead.phone ? <span key="p" className="admin-contact-links"><a href={telHref(lead.phone)}>{lead.phone}</a>{channel === 'whatsapp' && <a href={whatsappHref(lead.phone)} target="_blank" rel="noopener noreferrer">Open in WhatsApp ↗</a>}</span> : '—'],
            ...(channel === 'email' ? [['Email', lead.email ? <a key="e" href={`mailto:${lead.email}`}>{lead.email}</a> : '—'] as [string, React.ReactNode]] : []),
            ['Topic', lead.topic || '—'], ['Consent', lead.consent ? 'Given' : 'Not given'],
            ['Team email', statusLabel(lead.notification_status)],
          ]} />
          <h2>Enquiry history ({messages.length})</h2>
          {messages.length ? <ol className="admin-history">{messages.map((message) => <li key={message.id}>
            <time>{formatDateTime(message.received_at)}</time>
            {message.subject && <strong>{message.subject}</strong>}
            <p className="admin-pre">{message.body}</p>
          </li>)}</ol> : <p className="admin-empty">No messages recorded.</p>}
          {channel === 'whatsapp' && <p className="admin-hint">Saved when the visitor pressed “Start chat”. WhatsApp does not confirm whether they then sent the message.</p>}
        </section>
        <section className="admin-panel"><h2>Manage</h2><UpdateForm action={updateLead} id={lead.id} table="communication_leads" status={lead.status} notes={lead.admin_notes} statuses={leadStatuses} /></section>
      </div>
    </>
  );
}
