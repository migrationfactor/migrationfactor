'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addPayment, removeInvoice, sendInvoice } from '@/app/admin/invoice-actions';
import type { AppSettings } from '@/lib/invoices/settings';
import type { InvoiceWithItems } from '@/lib/invoices/service';
import { effectiveStatus, formatInvoiceDate, formatMoney, lineTotals } from '@/lib/invoices/totals';
import { paymentModes, validatePayment } from '@/lib/invoices/validation';
import StatusBadge from '@/components/admin/StatusBadge';

interface Props { invoice: InvoiceWithItems; settings: AppSettings; today: string; notice: string; onEdit: () => void }

export default function InvoiceView({ invoice, settings, today, notice, onEdit }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(notice ? { text: notice, error: false } : null);
  const [pending, startTransition] = useTransition();
  const paymentDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [payment, setPayment] = useState({ amount: String(invoice.balance_due), payment_date: today, mode: 'Bank Transfer', reference_number: '', notes: '' });
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const status = effectiveStatus(invoice.status, invoice.due_date, invoice.balance_due, today);
  const fm = (n: number) => formatMoney(n, invoice.currency);
  const website = (settings.website_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  function run(action: () => Promise<{ ok: boolean; message: string }>, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage({ text: result.message, error: !result.ok });
      if (result.ok) { after?.(); router.refresh(); }
    });
  }

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const data = { ...payment, amount: Number(payment.amount) };
    const { errors } = validatePayment(data);
    setPaymentErrors(errors);
    if (Object.keys(errors).length) return;
    run(() => addPayment(invoice.id, data), () => paymentDialog.current?.close());
  }

  return (
    <div className="invoice-view">
      <Link className="admin-back" href="/admin/invoices">← All invoices</Link>
      <header className="admin-header admin-header-actions">
        <h1>{invoice.invoice_number}</h1>
        <StatusBadge status={status} />
        <div className="invoice-toolbar" role="toolbar" aria-label="Invoice actions">
          <button type="button" className="admin-button admin-button-secondary" onClick={onEdit} disabled={pending}>Edit</button>
          <button type="button" className="admin-button admin-button-secondary" disabled={pending} onClick={() => run(() => sendInvoice(invoice.id))}>{pending ? 'Working…' : 'Send Email'}</button>
          <a className="admin-button admin-button-secondary" href={`/api/invoices/${invoice.id}/pdf?download=1`}>Download PDF</a>
          {invoice.status !== 'paid' && invoice.balance_due > 0 && <button type="button" className="admin-button" disabled={pending} onClick={() => { setPayment((p) => ({ ...p, amount: String(invoice.balance_due) })); setPaymentErrors({}); paymentDialog.current?.showModal(); }}>Record Payment</button>}
          <button type="button" className="admin-button admin-button-danger" disabled={pending} onClick={() => deleteDialog.current?.showModal()}>Delete</button>
        </div>
      </header>
      <p role="status" aria-live="polite" className={`admin-message${message?.error ? ' error' : ''}`}>{message?.text}</p>

      <article className="invoice-paper" aria-label={`Invoice ${invoice.invoice_number}`}>
        <div className="invoice-paper-head">
          <div>
            <h2>{settings.business_name}</h2>
            <p>{[settings.tagline, settings.registration_number].filter(Boolean).join(' | ')}</p>
            {settings.office_address && <p>{settings.office_address}</p>}
            <p>{[settings.contact_email, settings.contact_phone].filter(Boolean).join(' | ')}</p>
          </div>
          <div className="invoice-paper-title">
            <strong>Tax Invoice</strong>
            <span># {invoice.invoice_number}</span>
            <span className="invoice-paper-balance">Balance Due<b>{fm(invoice.balance_due)}</b></span>
          </div>
        </div>
        <div className="invoice-paper-meta">
          <div>
            <small>BILL TO</small>
            <strong>{invoice.bill_to_name}</strong>
            <span>{invoice.bill_to_email}</span>
            {invoice.bill_to_phone && <span>{invoice.bill_to_phone}</span>}
            {invoice.bill_to_address && <span className="admin-pre">{invoice.bill_to_address}</span>}
          </div>
          <dl>
            <div><dt>Invoice Date</dt><dd>{formatInvoiceDate(invoice.invoice_date)}</dd></div>
            <div><dt>Due Date</dt><dd>{formatInvoiceDate(invoice.due_date)}</dd></div>
            <div><dt>Terms</dt><dd>{invoice.terms}</dd></div>
          </dl>
        </div>
        <div className="admin-table-wrap invoice-paper-table">
          <table className="admin-table">
            <thead><tr><th scope="col">#</th><th scope="col">Item &amp; Description</th><th scope="col" className="admin-num">Qty</th><th scope="col" className="admin-num">Rate</th><th scope="col" className="admin-num">Discount</th><th scope="col" className="admin-num">Tax</th><th scope="col" className="admin-num">Amount</th></tr></thead>
            <tbody>{invoice.line_items.map((line, i) => (
              <tr key={line.id}>
                <td data-label="#">{i + 1}</td>
                <td data-label="Item"><strong>{line.item_name}</strong>{line.description && <small>{line.description}</small>}</td>
                <td data-label="Qty" className="admin-num">{Number(line.quantity)}</td>
                <td data-label="Rate" className="admin-num">{fm(line.rate)}</td>
                <td data-label="Discount" className="admin-num">{line.discount_percent ? `${Number(line.discount_percent)}%` : '-'}</td>
                <td data-label="Tax" className="admin-num">{line.tax_percent ? `${Number(line.tax_percent)}%` : '-'}</td>
                <td data-label="Amount" className="admin-num">{fm(lineTotals(line).amount)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <dl className="invoice-totals">
          <div><dt>Sub Total</dt><dd>{fm(invoice.subtotal)}</dd></div>
          {invoice.discount_total > 0 && <div><dt>Discount</dt><dd>-{fm(invoice.discount_total)}</dd></div>}
          {invoice.tax_total > 0 && <div><dt>Tax</dt><dd>{fm(invoice.tax_total)}</dd></div>}
          <div className="invoice-total"><dt>Total</dt><dd>{fm(invoice.total)}</dd></div>
          <div><dt>Payment Made</dt><dd>{invoice.amount_paid > 0 ? `(-) ${fm(invoice.amount_paid)}` : fm(0)}</dd></div>
          <div className="invoice-balance"><dt>Balance Due</dt><dd>{fm(invoice.balance_due)}</dd></div>
        </dl>
        {invoice.notes && <div className="invoice-paper-notes"><small>NOTES</small><p className="admin-pre">{invoice.notes}</p></div>}
        <p className="invoice-paper-foot">Thank you for your business{website ? ` | ${website}` : ''}</p>
      </article>

      <section className="admin-panel invoice-payments">
        <h2>Payments received</h2>
        {invoice.payments.length ? <ul className="admin-list">{invoice.payments.map((p) => (
          <li key={p.id}><strong>{fm(p.amount)}</strong><span>{formatInvoiceDate(p.payment_date)} · {p.mode}{p.reference_number ? ` · Ref ${p.reference_number}` : ''}</span>{p.notes && <span>{p.notes}</span>}</li>
        ))}</ul> : <p className="admin-empty">No payments recorded yet.</p>}
        {invoice.booking_id && <p><Link href={`/admin/bookings/${invoice.booking_id}`}>View linked booking →</Link></p>}
      </section>

      <dialog ref={paymentDialog} className="admin-dialog" aria-labelledby="payment-title">
        <form onSubmit={submitPayment} noValidate>
          <h2 id="payment-title">Record Payment</h2>
          <label>Amount * ({invoice.currency})<input type="number" min="0.01" step="0.01" inputMode="decimal" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} aria-invalid={Boolean(paymentErrors.amount)} />{paymentErrors.amount && <span className="field-error">{paymentErrors.amount}</span>}</label>
          <label>Payment Date<input type="date" value={payment.payment_date} onChange={(e) => setPayment({ ...payment, payment_date: e.target.value })} aria-invalid={Boolean(paymentErrors.payment_date)} />{paymentErrors.payment_date && <span className="field-error">{paymentErrors.payment_date}</span>}</label>
          <label>Mode<select value={payment.mode} onChange={(e) => setPayment({ ...payment, mode: e.target.value })}>{paymentModes.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label>Reference Number<input value={payment.reference_number} maxLength={120} onChange={(e) => setPayment({ ...payment, reference_number: e.target.value })} /></label>
          <label>Notes<textarea rows={2} value={payment.notes} maxLength={1000} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} /></label>
          <div className="invoice-actions">
            <button type="submit" className="admin-button" disabled={pending}>{pending ? 'Saving…' : 'Record Payment'}</button>
            <button type="button" className="admin-link-action" onClick={() => paymentDialog.current?.close()}>Cancel</button>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteDialog} className="admin-dialog" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete {invoice.invoice_number}?</h2>
        <p>This permanently deletes the invoice, its items and its payment records.</p>
        <div className="invoice-actions">
          <button type="button" className="admin-button admin-button-danger" disabled={pending} onClick={() => run(() => removeInvoice(invoice.id), () => { deleteDialog.current?.close(); router.push('/admin/invoices'); })}>Delete invoice</button>
          <button type="button" className="admin-link-action" onClick={() => deleteDialog.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </div>
  );
}
