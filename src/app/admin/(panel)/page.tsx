import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { dashboardSummary, leadActivity } from '@/lib/admin/queries';
import StatusBadge from '@/components/admin/StatusBadge';
import SourceBadge from '@/components/admin/SourceBadge';
import LeadActivityChart from '@/components/admin/LeadActivityChart';
import { formatDateTime } from '@/components/admin/format';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const requested = Number((await searchParams).days);
  const period = requested === 7 || requested === 90 ? requested : 30;
  const [{ totals, recentContacts, recentTools, recentMessages, nextBookings }, activity] = await Promise.all([dashboardSummary(), leadActivity(period)]);
  const cards: [string, number, string, string][] = [
    ['New WhatsApp leads', totals.whatsappNew, `${totals.whatsappTotal} total`, '/admin/whatsapp-leads?status=new'],
    ['New email leads', totals.emailNew, `${totals.emailTotal} total`, '/admin/email-leads?status=new'],
    ['New contact form leads', totals.contactNew, `${totals.contactTotal} total`, '/admin/leads?status=new'],
    ['Pending bookings', totals.bookingsPending, `${totals.bookingsUpcoming} upcoming`, '/admin/bookings?status=pending&when=all'],
    ['New tool leads', totals.toolNew, `${totals.toolTotal} total`, '/admin/tool-leads?status=new'],
  ];
  return (
    <>
      <header className="admin-header"><h1>Dashboard</h1></header>
      <div className="admin-cards">{cards.map(([label, value, note, href]) => (
        <Link key={label} href={href} className="admin-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></Link>
      ))}</div>
      <LeadActivityChart days={activity} period={period} />
      <div className="admin-panels">
        <section className="admin-panel"><h2>Latest WhatsApp &amp; email leads</h2>
          {recentMessages.length ? <ul className="admin-list">{recentMessages.map((lead) => <li key={lead.id}><Link href={`/admin/${lead.channel}-leads/${lead.id}`}>{lead.name}</Link><SourceBadge source={lead.channel} /><span>{lead.channel === 'email' ? lead.email : lead.phone}{lead.topic ? ` · ${lead.topic}` : ''}</span><StatusBadge status={lead.status} /><time>{formatDateTime(lead.last_message_at)}</time></li>)}</ul> : <p className="admin-empty">No WhatsApp or email leads yet.</p>}
        </section>
        <section className="admin-panel"><h2>Latest contact form leads</h2>
          {recentContacts.length ? <ul className="admin-list">{recentContacts.map((lead) => <li key={lead.id}><Link href={`/admin/leads/${lead.id}`}>{lead.name}</Link><SourceBadge source="contact" /><span>{lead.service}</span><StatusBadge status={lead.status} /><time>{formatDateTime(lead.created_at)}</time></li>)}</ul> : <p className="admin-empty">No contact leads yet.</p>}
        </section>
        <section className="admin-panel"><h2>Next consultations</h2>
          {nextBookings.length ? <ul className="admin-list">{nextBookings.map((booking) => <li key={booking.id}><Link href={`/admin/bookings/${booking.id}`}>{booking.name}</Link><SourceBadge source="booking" /><span>{booking.preferred_date} {booking.preferred_time.slice(0, 5)} ({booking.timezone})</span><StatusBadge status={booking.status} /><span>{booking.reference}</span></li>)}</ul> : <p className="admin-empty">No upcoming bookings.</p>}
        </section>
        <section className="admin-panel"><h2>Latest tool leads</h2>
          {recentTools.length ? <ul className="admin-list">{recentTools.map((lead) => <li key={lead.id}><Link href={`/admin/tool-leads/${lead.id}`}>{lead.name}</Link><SourceBadge source="tool" /><span>{lead.tool_name}</span><StatusBadge status={lead.status} /><time>{formatDateTime(lead.created_at)}</time></li>)}</ul> : <p className="admin-empty">No tool leads yet.</p>}
        </section>
      </div>
    </>
  );
}
