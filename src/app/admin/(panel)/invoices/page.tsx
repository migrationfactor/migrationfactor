import Link from 'next/link';
import Form from 'next/form';
import { withAdmin } from '@/lib/admin/auth';
import { invoiceSummary, listInvoices } from '@/lib/invoices/service';
import { getSettings } from '@/lib/invoices/settings';
import { businessToday, currencies, effectiveStatus, formatInvoiceDate, formatMoney, invoiceStatuses, type Currency } from '@/lib/invoices/totals';
import StatusBadge from '@/components/admin/StatusBadge';
import { statusLabel } from '@/components/admin/format';

export const metadata = { title: 'Invoices' };
type Search = Promise<{ q?: string; status?: string; currency?: string }>;

export default async function InvoicesPage({ searchParams }: { searchParams: Search }) {
  const { q = '', status = '', currency: requested = '' } = await searchParams;
  const [all, settings] = await withAdmin(Promise.all([listInvoices(), getSettings()]));
  // Cards add up money, so they only ever cover one currency at a time.
  const currency = ((currencies as readonly string[]).includes(requested) ? requested : settings.invoice_currency) as Currency;
  const invoices = all.filter((invoice) => invoice.currency === currency);
  const fm = (n: number) => formatMoney(n, currency);
  const today = businessToday();
  const summary = invoiceSummary(invoices, today);
  const term = q.trim().toLowerCase().slice(0, 80);
  const rows = invoices
    .map((invoice) => ({ ...invoice, shown: effectiveStatus(invoice.status, invoice.due_date, invoice.balance_due, today) }))
    .filter((invoice) => !status || invoice.shown === status)
    .filter((invoice) => !term || [invoice.bill_to_name, invoice.bill_to_email, invoice.invoice_number].some((v) => v.toLowerCase().includes(term)));
  const cards: [string, string, string?][] = [
    ['Outstanding', fm(summary.outstanding)],
    ['Due Today', fm(summary.dueToday)],
    ['Due in 30 Days', fm(summary.dueIn30)],
    ['Overdue', fm(summary.overdue), summary.overdue > 0 ? 'admin-card-alert' : undefined],
    ['Avg. Days to Get Paid', summary.avgDaysToPay === null ? '—' : `${summary.avgDaysToPay} day${summary.avgDaysToPay === 1 ? '' : 's'}`],
  ];
  return (
    <>
      <header className="admin-header admin-header-actions">
        <h1>Invoices</h1>
        <Link href="/admin/invoices/new" className="admin-button">+ New Invoice</Link>
      </header>
      <div className="admin-cards admin-cards-5">{cards.map(([label, value, tone]) => (
        <div key={label} className={`admin-card${tone ? ` ${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div>
      ))}</div>
      <Form className="admin-filters" action="" role="search">
        <label>Search<input type="search" name="q" defaultValue={q} maxLength={80} placeholder="Search customer or invoice #..." /></label>
        <label>Currency<select name="currency" defaultValue={currency}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Status<select name="status" defaultValue={status}>
          <option value="">All</option>
          {invoiceStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select></label>
        <button type="submit" className="admin-button">Apply</button>
      </Form>
      {rows.length ? <div className="admin-table-wrap"><table className="admin-table admin-table-links">
        <thead><tr><th scope="col">Date</th><th scope="col">Invoice #</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Due Date</th><th scope="col" className="admin-num">Amount</th><th scope="col" className="admin-num">Balance Due</th></tr></thead>
        <tbody>{rows.map((invoice) => <tr key={invoice.id}>
          <td data-label="Date">{formatInvoiceDate(invoice.invoice_date)}</td>
          <td data-label="Invoice #"><Link className="admin-row-link" href={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</Link></td>
          <td data-label="Customer">{invoice.bill_to_name}<small>{invoice.bill_to_email}</small></td>
          <td data-label="Status"><StatusBadge status={invoice.shown} /></td>
          <td data-label="Due Date">{formatInvoiceDate(invoice.due_date)}</td>
          <td data-label="Amount" className="admin-num">{fm(invoice.total)}</td>
          <td data-label="Balance Due" className="admin-num">{fm(invoice.balance_due)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="admin-empty"><strong>No Invoices Found</strong><p>{invoices.length ? 'Try a different search or status.' : all.length ? `There are no ${currency} invoices. Switch the currency filter to see the others.` : 'Create your first invoice with “+ New Invoice”.'}</p></div>}
    </>
  );
}
