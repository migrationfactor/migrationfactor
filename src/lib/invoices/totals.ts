/** Invoice money math shared by the editor, the server and the PDF, so every total matches. */
export interface LineInput {
  quantity: number;
  rate: number;
  discount_percent: number;
  tax_percent: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotals(line: LineInput) {
  const gross = line.quantity * line.rate;
  const discount = gross * (line.discount_percent / 100);
  const amount = round2(gross - discount);
  const tax = round2(amount * (line.tax_percent / 100));
  return { gross, discount, amount, tax };
}

export function invoiceTotals(lines: LineInput[], amountPaid = 0) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    const t = lineTotals(line);
    subtotal += t.amount;
    discountTotal += t.discount;
    taxTotal += t.tax;
  }
  const total = round2(round2(subtotal) + round2(taxTotal));
  return {
    subtotal: round2(subtotal),
    discount_total: round2(discountTotal),
    tax_total: round2(taxTotal),
    total,
    amount_paid: round2(amountPaid),
    balance_due: round2(total - amountPaid),
  };
}

const money = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const currencies = ['PKR', 'AUD'] as const;
export type Currency = typeof currencies[number];
export const currencyNames: Record<Currency, string> = { PKR: 'PKR — Pakistani Rupee', AUD: 'AUD — Australian Dollar' };

/** AUD → `$1,234.56`, PKR → `PKR 1,234.56`; the sign always comes first. */
export function formatMoney(n: number, currency: Currency = 'AUD'): string {
  const value = round2(Number(n) || 0);
  const prefix = currency === 'PKR' ? 'PKR ' : '$';
  return `${value < 0 ? '-' : ''}${prefix}${money.format(Math.abs(value))}`;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-20` → `20 Oct 2026` without time-zone shifts. */
export function formatInvoiceDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  if (!match) return '';
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

/** Adds whole days to an ISO date string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const invoiceStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const;
export type InvoiceStatus = typeof invoiceStatuses[number];

/** A sent invoice past its due date with money owing is shown as overdue. */
export function effectiveStatus(status: InvoiceStatus, dueDate: string, balanceDue: number, today: string): InvoiceStatus {
  if (status === 'sent' && balanceDue > 0 && dueDate < today) return 'overdue';
  return status;
}

/** Today's date where the business is based (Perth), as YYYY-MM-DD. */
export function businessToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Perth', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
