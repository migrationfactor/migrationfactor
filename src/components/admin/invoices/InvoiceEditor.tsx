'use client';
import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveInvoice } from '@/app/admin/invoice-actions';
import type { CatalogItem, CustomerSuggestion, InvoiceWithItems } from '@/lib/invoices/service';
import { currencies, currencyNames, invoiceStatuses, invoiceTotals, lineTotals, formatMoney, type Currency } from '@/lib/invoices/totals';
import { validateInvoice, type InvoiceInput } from '@/lib/invoices/validation';
import { statusLabel } from '@/components/admin/format';

interface Row { key: number; item_name: string; description: string; quantity: string; rate: string; discount_percent: string; tax_percent: string }

interface Props {
  invoice: InvoiceWithItems | null;
  defaults: InvoiceInput | null;
  catalog: CatalogItem[];
  customers: CustomerSuggestion[];
  onCancel?: () => void;
  onSaved: (message: string) => void;
}

let rowKey = 0;
const toRow = (line: { item_name: string; description?: string | null; quantity: number; rate: number; discount_percent: number; tax_percent: number }): Row => ({
  key: ++rowKey, item_name: line.item_name, description: line.description || '', quantity: String(line.quantity),
  rate: String(line.rate), discount_percent: String(line.discount_percent), tax_percent: String(line.tax_percent),
});
const emptyRow = (): Row => toRow({ item_name: '', description: '', quantity: 1, rate: 0, discount_percent: 0, tax_percent: 0 });
const n = (value: string) => { const v = Number(value); return Number.isFinite(v) ? v : 0; };

export default function InvoiceEditor({ invoice, defaults, catalog, customers, onCancel, onSaved }: Props) {
  const router = useRouter();
  const source = invoice ?? defaults;
  const [fields, setFields] = useState({
    bill_to_name: source?.bill_to_name ?? '', bill_to_email: source?.bill_to_email ?? '', bill_to_phone: source?.bill_to_phone ?? '',
    bill_to_address: source?.bill_to_address ?? '', status: source?.status ?? 'draft', currency: (source?.currency ?? 'PKR') as Currency, invoice_date: source?.invoice_date ?? '',
    due_date: source?.due_date ?? '', terms: source?.terms ?? 'Due on Receipt', notes: source?.notes ?? '',
  });
  const [rows, setRows] = useState<Row[]>(() => (source?.line_items.length ? source.line_items.map(toRow) : [emptyRow()]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLParagraphElement>(null);

  const lines = rows.map((r) => ({ quantity: n(r.quantity), rate: n(r.rate), discount_percent: n(r.discount_percent), tax_percent: n(r.tax_percent) }));
  const totals = invoiceTotals(lines, invoice?.amount_paid ?? 0);
  const fm = (n: number) => formatMoney(n, fields.currency);

  function set<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const copy = { ...prev }; delete copy[key]; return copy; });
  }
  function chooseCustomer(name: string) {
    set('bill_to_name', name);
    const match = customers.find((c) => c.name === name);
    if (match) setFields((prev) => ({ ...prev, bill_to_name: match.name, bill_to_email: match.email, bill_to_phone: match.phone || prev.bill_to_phone }));
  }
  function setRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    // Row errors are rechecked on the next save.
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('line_'))));
  }
  function chooseItem(key: number, name: string) {
    const item = catalog.find((c) => c.name === name);
    setRow(key, item ? { item_name: item.name, description: item.description || '', rate: String(item.default_rate) } : { item_name: name });
  }

  function payload() {
    return {
      ...fields,
      booking_id: invoice?.booking_id ?? defaults?.booking_id ?? null,
      line_items: rows.map((r) => ({ item_name: r.item_name, description: r.description, quantity: n(r.quantity), rate: n(r.rate), discount_percent: n(r.discount_percent), tax_percent: n(r.tax_percent) })),
    };
  }

  function submit(send: boolean) {
    const data = payload();
    const { errors: found } = validateInvoice(data);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage({ text: 'Please check the highlighted fields.', error: true });
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.invoice-editor [aria-invalid="true"]')?.focus());
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, data, send);
      if (!result.ok) {
        setErrors(result.errors || {});
        setMessage({ text: result.message, error: true });
        statusRef.current?.focus();
        return;
      }
      if (!invoice && result.id) {
        router.replace(`/admin/invoices/${result.id}`);
        return;
      }
      onSaved(result.message);
      router.refresh();
    });
  }

  const err = (key: string) => (errors[key] ? <span className="field-error">{errors[key]}</span> : null);
  const lineErrors = Object.entries(errors).filter(([k]) => /^line_\d+$/.test(k)).map(([, v]) => v);

  return (
    <div className="invoice-editor">
      <Link className="admin-back" href="/admin/invoices">← All invoices</Link>
      <header className="admin-header"><h1>{invoice ? `Edit ${invoice.invoice_number}` : 'New Invoice'}</h1></header>
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(false); }}>
        <section className="admin-panel invoice-form-grid">
          <label className="span-2">Customer Name *
            <input list="invoice-customers" value={fields.bill_to_name} onChange={(e) => chooseCustomer(e.target.value)} placeholder="Select or type a customer name..." maxLength={160} aria-invalid={Boolean(errors.bill_to_name)} autoComplete="off" />
            <datalist id="invoice-customers">{customers.map((c) => <option key={c.email} value={c.name}>{c.email}</option>)}</datalist>
            {err('bill_to_name')}
          </label>
          <label>Email *<input type="email" value={fields.bill_to_email} onChange={(e) => set('bill_to_email', e.target.value)} maxLength={254} aria-invalid={Boolean(errors.bill_to_email)} />{err('bill_to_email')}</label>
          <label>Phone<input type="tel" value={fields.bill_to_phone} onChange={(e) => set('bill_to_phone', e.target.value)} maxLength={40} aria-invalid={Boolean(errors.bill_to_phone)} />{err('bill_to_phone')}</label>
          <label>Currency<select value={fields.currency} onChange={(e) => set('currency', e.target.value as Currency)}>
            {currencies.map((c) => <option key={c} value={c}>{currencyNames[c]}</option>)}
          </select></label>
          <label>Status<select value={fields.status} onChange={(e) => set('status', e.target.value as typeof fields.status)}>
            {invoiceStatuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select></label>
          <label className="span-2">Billing Address<textarea rows={2} value={fields.bill_to_address} onChange={(e) => set('bill_to_address', e.target.value)} maxLength={1000} /></label>
          <label>Invoice Date *<input type="date" value={fields.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} aria-invalid={Boolean(errors.invoice_date)} />{err('invoice_date')}</label>
          <label>Due Date *<input type="date" value={fields.due_date} onChange={(e) => set('due_date', e.target.value)} aria-invalid={Boolean(errors.due_date)} />{err('due_date')}</label>
          <label>Terms<input value={fields.terms} onChange={(e) => set('terms', e.target.value)} maxLength={80} list="invoice-terms" />
            <datalist id="invoice-terms">{['Due on Receipt', 'Net 7', 'Net 15', 'Net 30'].map((t) => <option key={t} value={t} />)}</datalist></label>
          {invoice && <div className="invoice-readonly"><span>Amount Paid <strong>{fm(invoice.amount_paid)}</strong></span><span>Balance Due <strong>{fm(totals.balance_due)}</strong></span></div>}
        </section>

        <section className="admin-panel">
          <h2>Item Table</h2>
          <datalist id="invoice-catalog">{catalog.map((c) => <option key={c.id} value={c.name}>{fm(c.default_rate)}</option>)}</datalist>
          <div className="invoice-items" role="table" aria-label="Invoice items">
            <div className="invoice-item invoice-item-head" role="row">
              <span role="columnheader">Item &amp; Description</span><span role="columnheader">Qty</span><span role="columnheader">Rate</span>
              <span role="columnheader">Discount %</span><span role="columnheader">Tax %</span><span role="columnheader" className="admin-num">Amount</span><span aria-hidden="true" />
            </div>
            {rows.map((row, i) => {
              const amount = lineTotals(lines[i]).amount;
              const invalid = Boolean(errors[`line_${i}`]);
              return (
                <div className="invoice-item" role="row" key={row.key}>
                  <div className="invoice-item-name">
                    <input list="invoice-catalog" aria-label={`Row ${i + 1} item`} placeholder="Type or select an item..." value={row.item_name} maxLength={160} aria-invalid={invalid} onChange={(e) => chooseItem(row.key, e.target.value)} autoComplete="off" />
                    <textarea aria-label={`Row ${i + 1} description`} placeholder="Description (optional)" rows={1} value={row.description} maxLength={1000} onChange={(e) => setRow(row.key, { description: e.target.value })} />
                  </div>
                  <label className="invoice-cell"><span className="invoice-cell-label">Qty</span><input aria-label={`Row ${i + 1} quantity`} type="number" min="0" step="0.01" inputMode="decimal" value={row.quantity} onChange={(e) => setRow(row.key, { quantity: e.target.value })} /></label>
                  <label className="invoice-cell"><span className="invoice-cell-label">Rate</span><input aria-label={`Row ${i + 1} rate`} type="number" min="0" step="0.01" inputMode="decimal" value={row.rate} onChange={(e) => setRow(row.key, { rate: e.target.value })} /></label>
                  <label className="invoice-cell"><span className="invoice-cell-label">Discount %</span><input aria-label={`Row ${i + 1} discount percent`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={row.discount_percent} onChange={(e) => setRow(row.key, { discount_percent: e.target.value })} /></label>
                  <label className="invoice-cell"><span className="invoice-cell-label">Tax %</span><input aria-label={`Row ${i + 1} tax percent`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={row.tax_percent} onChange={(e) => setRow(row.key, { tax_percent: e.target.value })} /></label>
                  <span className="admin-num invoice-item-amount" aria-label={`Row ${i + 1} amount`}>{fm(amount)}</span>
                  <button type="button" className="invoice-remove" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>×</button>
                </div>
              );
            })}
          </div>
          {errors.line_items && <span className="field-error">{errors.line_items}</span>}
          {lineErrors.map((e) => <span key={e} className="field-error">{e}</span>)}
          <button type="button" className="admin-link-action" onClick={() => setRows((prev) => [...prev, emptyRow()])}>+ Add New Row</button>

          <div className="invoice-bottom">
            <label className="invoice-notes">Customer Notes<textarea rows={4} value={fields.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} /></label>
            <dl className="invoice-totals">
              <div><dt>Subtotal</dt><dd>{fm(totals.subtotal)}</dd></div>
              <div><dt>Discount</dt><dd>{totals.discount_total > 0 ? `-${fm(totals.discount_total)}` : fm(0)}</dd></div>
              <div><dt>Tax</dt><dd>{fm(totals.tax_total)}</dd></div>
              <div className="invoice-total"><dt>Total</dt><dd>{fm(totals.total)}</dd></div>
            </dl>
          </div>
        </section>

        <div className="invoice-actions">
          <button type="submit" className="admin-button" disabled={pending}>{pending ? 'Saving…' : fields.status === 'draft' ? 'Save as Draft' : 'Save'}</button>
          <button type="button" className="admin-button admin-button-secondary" disabled={pending} onClick={() => submit(true)}>Save and Send</button>
          {onCancel ? <button type="button" className="admin-link-action" disabled={pending} onClick={onCancel}>Cancel</button> : <Link className="admin-link-action" href="/admin/invoices">Cancel</Link>}
        </div>
        <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className={`admin-message${message?.error ? ' error' : ''}`}>{message?.text}</p>
      </form>
    </div>
  );
}
