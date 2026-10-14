import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { dashboardSummary } from '@/lib/admin/queries';
import StatusBadge from '@/components/admin/StatusBadge';
import { formatDateTime } from '@/components/admin/format';

export const metadata = { title: 'Dashboard' };

export default async function AdminDashboard() {
  await requireAdmin();
  const { totals, recentContacts, recentTools, nextBookings } = await dashboardSummary();
  const cards: [string, number, string, string][] = [
    ['New contact leads', totals.contactNew, `${totals.contactTotal} total`, '/admin/leads?status=new'],
    ['New tool leads', totals.toolNew, `${totals.toolTotal} total`, '/admin/tool-leads?status=new'],
    ['Pending bookings', totals.bookingsPending, 'Awaiting confirmation', '/admin/bookings?status=pending&when=all'],
    ['Upcoming bookings', totals.bookingsUpcoming, 'Pending or confirmed', '/admin/bookings'],
  ];
  return (
    <>
      <header className="admin-header"><h1>Dashboard</h1></header>
      <div className="admin-cards">{cards.map(([label, value, note, href]) => (
        <Link key={label} href={href} className="admin-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></Link>
      ))}</div>
      <div className="admin-panels">
        <section className="admin-panel"><h2>Latest contact leads</h2>
          {recentContacts.length ? <ul className="admin-list">{recentContacts.map((lead) => <li key={lead.id}><Link href={`/admin/leads/${lead.id}`}>{lead.name}</Link><span>{lead.service}</span><StatusBadge status={lead.status} /><time>{formatDateTime(lead.created_at)}</time></li>)}</ul> : <p className="admin-empty">No contact leads yet.</p>}
        </section>
        <section className="admin-panel"><h2>Latest tool leads</h2>
          {recentTools.length ? <ul className="admin-list">{recentTools.map((lead) => <li key={lead.id}><Link href={`/admin/tool-leads/${lead.id}`}>{lead.name}</Link><span>{lead.tool_name}</span><StatusBadge status={lead.status} /><time>{formatDateTime(lead.created_at)}</time></li>)}</ul> : <p className="admin-empty">No tool leads yet.</p>}
        </section>
        <section className="admin-panel"><h2>Next consultations</h2>
          {nextBookings.length ? <ul className="admin-list">{nextBookings.map((booking) => <li key={booking.id}><Link href={`/admin/bookings/${booking.id}`}>{booking.name}</Link><span>{booking.preferred_date} {booking.preferred_time.slice(0, 5)} ({booking.timezone})</span><StatusBadge status={booking.status} /><span>{booking.reference}</span></li>)}</ul> : <p className="admin-empty">No upcoming bookings.</p>}
        </section>
      </div>
    </>
  );
}
