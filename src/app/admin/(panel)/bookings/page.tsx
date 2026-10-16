import Link from 'next/link';
import { withAdmin } from '@/lib/admin/auth';
import { listBookings, markSectionSeen } from '@/lib/admin/queries';
import { bookingStatuses } from '@/lib/leads/validation';
import Filters from '@/components/admin/Filters';
import Pagination from '@/components/admin/Pagination';
import StatusBadge from '@/components/admin/StatusBadge';
import UnreadDot from '@/components/admin/UnreadDot';
import { formatDateTime } from '@/components/admin/format';

export const metadata = { title: 'Bookings' };
type Search = Promise<{ q?: string; status?: string; when?: string; page?: string }>;
const whenOptions: [string, string][] = [['', 'Upcoming'], ['past', 'Past'], ['all', 'All (newest first)']];

export default async function BookingsPage({ searchParams }: { searchParams: Search }) {
  const { q, status, when, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const [{ rows, count }] = await withAdmin(Promise.all([listBookings({ q, status, when, page }), markSectionSeen('booking')]));
  return (
    <>
      <header className="admin-header"><h1>Consultation bookings</h1><p>Requests from the booking form. Times are the client’s preference until you confirm them.</p></header>
      <Filters q={q} status={status} statuses={bookingStatuses} extra={{ name: 'when', label: 'Show', value: when, options: whenOptions }} />
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th scope="col">Preferred time</th><th scope="col">Reference</th><th scope="col">Name</th><th scope="col">Contact</th><th scope="col">Service</th><th scope="col">Format</th><th scope="col">Status</th></tr></thead>
        <tbody>{rows.map((booking) => <tr key={booking.id} className={booking.viewed_at ? undefined : 'admin-row-unread'}>
          <td data-label="Preferred time">{booking.preferred_date} {booking.preferred_time.slice(0, 5)} PKT<small>{formatDateTime(booking.starts_at)}</small></td>
          <td data-label="Reference"><Link href={`/admin/bookings/${booking.id}`}>{booking.reference}</Link></td>
          <td data-label="Name"><UnreadDot viewedAt={booking.viewed_at} />{booking.name}</td>
          <td data-label="Contact"><a href={`mailto:${booking.email}`}>{booking.email}</a><small>{booking.phone}</small></td>
          <td data-label="Service">{booking.service}</td>
          <td data-label="Format">{booking.format === 'phone' ? 'Phone' : 'Video'}</td>
          <td data-label="Status"><StatusBadge status={booking.status} /></td>
        </tr>)}</tbody>
      </table></div> : <p className="admin-empty">No bookings match these filters.</p>}
      <Pagination page={page} count={count} params={{ q, status, when }} />
    </>
  );
}
