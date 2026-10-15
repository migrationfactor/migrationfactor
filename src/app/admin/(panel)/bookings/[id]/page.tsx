import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getRecord, markViewed, type Booking } from '@/lib/admin/queries';
import { bookingStatuses } from '@/lib/leads/validation';
import { updateBooking } from '@/app/admin/actions';
import UpdateForm from '@/components/admin/UpdateForm';
import StatusBadge from '@/components/admin/StatusBadge';
import SourceBadge from '@/components/admin/SourceBadge';
import DetailList from '@/components/admin/DetailList';
import { formatDateTime, statusLabel, telHref } from '@/components/admin/format';

export const metadata = { title: 'Booking' };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const booking = await getRecord<Booking>('bookings', id);
  if (!booking) notFound();
  await markViewed('bookings', booking);
  return (
    <>
      <Link className="admin-back" href="/admin/bookings">← All bookings</Link>
      <header className="admin-header"><h1>{booking.name}</h1><SourceBadge source="booking" /><StatusBadge status={booking.status} /></header>
      <div className="admin-detail">
        <section className="admin-panel"><h2>Booking request</h2>
          <DetailList rows={[
            ['Reference', booking.reference],
            ['Preferred time', `${booking.preferred_date} at ${booking.preferred_time.slice(0, 5)} (${booking.timezone})`],
            ['Perth time', formatDateTime(booking.starts_at)], ['Duration', `${booking.duration_minutes} minutes`],
            ['Format', booking.format === 'phone' ? 'Phone' : 'Video'], ['Service', booking.service], ['Name', booking.name],
            ['Email', <a key="e" href={`mailto:${booking.email}`}>{booking.email}</a>],
            ['Phone', <a key="p" href={telHref(booking.phone)}>{booking.phone}</a>],
            ['Country of residence', booking.country], ['Consent', booking.consent ? 'Given' : 'Not given'],
            ['Requested', formatDateTime(booking.created_at)], ['Team email', statusLabel(booking.notification_status)],
          ]} />
          <h2>Enquiry</h2><p className="admin-pre">{booking.message}</p></section>
        <section className="admin-panel"><h2>Manage</h2>
          <p className="admin-hint">Confirm only after checking the consultant’s availability. A time can be confirmed for one client only.</p>
          <UpdateForm action={updateBooking} id={booking.id} status={booking.status} notes={booking.admin_notes} statuses={bookingStatuses} notifyOption /></section>
      </div>
    </>
  );
}
