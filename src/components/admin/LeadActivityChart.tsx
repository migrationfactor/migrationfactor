import Link from 'next/link';
import type { leadActivity } from '@/lib/admin/queries';
import { sourceLabels, type LeadSource } from './SourceBadge';

type Day = Awaited<ReturnType<typeof leadActivity>>[number];

// Fixed order so each source keeps its colour whatever the period. Palette validated for colour-vision deficiency.
const series: LeadSource[] = ['whatsapp', 'email', 'contact', 'booking', 'tool'];
const shortLabels: Record<LeadSource, string> = { whatsapp: 'WhatsApp', email: 'Email', contact: 'Contact form', booking: 'Bookings', tool: 'Visa tools' };
const dateLabel = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const label = (day: string) => dateLabel.format(new Date(`${day}T00:00:00Z`));

/** Daily leads stacked by source, with per-day hover details and a table view. Server-rendered. */
export default function LeadActivityChart({ days, period }: { days: Day[]; period: 7 | 30 | 90 }) {
  const totals = Object.fromEntries(series.map(key => [key, days.reduce((sum, day) => sum + day[key], 0)])) as Record<LeadSource, number>;
  const max = Math.max(1, ...days.map(day => series.reduce((sum, key) => sum + day[key], 0)));
  const grand = series.reduce((sum, key) => sum + totals[key], 0);
  const tickEvery = period === 7 ? 1 : period === 30 ? 5 : 15;
  return (
    <section className="admin-panel admin-activity" aria-labelledby="activity-title">
      <div className="admin-activity-head">
        <div><h2 id="activity-title">Leads by source</h2><p>{grand} lead{grand === 1 ? '' : 's'} in the last {period} days (Perth time)</p></div>
        <nav className="admin-periods" aria-label="Chart period">
          {([7, 30, 90] as const).map(value => <Link key={value} href={`?days=${value}`} aria-current={value === period ? 'true' : undefined} scroll={false}>{value} days</Link>)}
        </nav>
      </div>
      <ul className="admin-legend">
        {series.map(key => <li key={key}><span className={`admin-swatch admin-fill-${key}`} aria-hidden="true" />{shortLabels[key]}<strong>{totals[key]}</strong></li>)}
      </ul>
      <div className="admin-chart" role="img" aria-label={`Daily leads by source for the last ${period} days. Full figures are in the table below.`}>
        <div className="admin-chart-axis" aria-hidden="true"><span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span></div>
        <div className="admin-chart-plot" style={{ '--bars': days.length } as React.CSSProperties}>
          {days.map((day, index) => {
            const total = series.reduce((sum, key) => sum + day[key], 0);
            return (
              <div className="admin-chart-col" key={day.day} tabIndex={0} aria-label={`${label(day.day)}: ${total} leads`}>
                <div className="admin-chart-stack" style={{ height: `${(total / max) * 100}%` }}>
                  {series.filter(key => day[key] > 0).map(key => <span key={key} className={`admin-fill-${key}`} style={{ flexGrow: day[key] }} />)}
                </div>
                <div className="admin-chart-tip" role="tooltip">
                  <strong>{label(day.day)} · {total} lead{total === 1 ? '' : 's'}</strong>
                  {series.map(key => <span key={key}><i className={`admin-swatch admin-fill-${key}`} />{shortLabels[key]}<b>{day[key]}</b></span>)}
                </div>
                {(index % tickEvery === 0 || index === days.length - 1) && <span className="admin-chart-tick" aria-hidden="true">{label(day.day)}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <details className="admin-chart-table">
        <summary>Show as table</summary>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th scope="col">Date</th>{series.map(key => <th scope="col" key={key}>{sourceLabels[key].replace('From ', '')}</th>)}<th scope="col">Total</th></tr></thead>
          <tbody>{[...days].reverse().map(day => <tr key={day.day}>
            <td data-label="Date">{label(day.day)}</td>
            {series.map(key => <td key={key} data-label={shortLabels[key]}>{day[key]}</td>)}
            <td data-label="Total">{series.reduce((sum, key) => sum + day[key], 0)}</td>
          </tr>)}</tbody>
        </table></div>
      </details>
    </section>
  );
}
