import 'server-only';
import { escapeHtml, sendEmail, type EmailOutcome } from '@/lib/email/resend';
import { generateInvoicePdf } from './pdf';
import { getSettings } from './settings';
import type { InvoiceWithItems } from './service';
import { businessToday, effectiveStatus, formatInvoiceDate, formatMoney } from './totals';

/** Emails the invoice PDF to the client through Resend. Returns the provider outcome; never throws. */
export async function sendInvoiceEmail(invoice: InvoiceWithItems): Promise<EmailOutcome> {
  const settings = await getSettings();
  const pdf = await generateInvoicePdf(invoice, settings);
  const status = effectiveStatus(invoice.status, invoice.due_date, invoice.balance_due, businessToday());
  const fm = (n: number) => formatMoney(n, invoice.currency);
  const subject = `Invoice ${invoice.invoice_number} from ${settings.business_name}`;
  const rows: [string, string][] = [
    ['Invoice', invoice.invoice_number],
    ['Amount', fm(invoice.total)],
    ['Balance due', fm(invoice.balance_due)],
    ['Due date', formatInvoiceDate(invoice.due_date)],
    ['Status', status.charAt(0).toUpperCase() + status.slice(1)],
  ];
  const contact = [settings.contact_email, settings.contact_phone].filter(Boolean).join(' or ');
  const text = [
    `Dear ${invoice.bill_to_name},`, '',
    `Please find attached invoice ${invoice.invoice_number} from ${settings.business_name}.`, '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '',
    ...(invoice.notes ? [invoice.notes, ''] : []),
    contact ? `Questions? Contact us at ${contact}.` : '',
    '', settings.business_name,
  ].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#042628;max-width:600px;margin:auto">
<div style="background:#0b666a;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><div style="font-size:20px;font-weight:bold">${escapeHtml(settings.business_name)}</div>${settings.tagline ? `<div style="font-size:13px;opacity:.85">${escapeHtml(settings.tagline)}</div>` : ''}</div>
<div style="border:1px solid #d7e6e6;border-top:0;padding:24px;border-radius:0 0 10px 10px">
<p>Dear ${escapeHtml(invoice.bill_to_name)},</p>
<p>Please find attached invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>.</p>
<div style="background:#f2f8f8;border-left:4px solid #35b5ac;padding:14px 18px;margin:18px 0"><div style="font-size:13px;color:#3d5557">Balance due</div><div style="font-size:26px;font-weight:bold;color:#0b666a">${escapeHtml(fm(invoice.balance_due))}</div></div>
<table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><th style="text-align:left;padding:7px 0;border-bottom:1px solid #e3eeee;color:#3d5557;font-weight:normal">${escapeHtml(k)}</th><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e3eeee;font-weight:bold">${escapeHtml(v)}</td></tr>`).join('')}</table>
${invoice.notes ? `<p style="white-space:pre-wrap;margin-top:18px;color:#3d5557">${escapeHtml(invoice.notes)}</p>` : ''}
${contact ? `<p style="margin-top:18px">Questions? Contact us at ${escapeHtml(contact)}.</p>` : ''}
<p style="margin-top:18px">${escapeHtml(settings.business_name)}</p></div></div>`;
  return sendEmail({
    to: invoice.bill_to_email,
    subject,
    text,
    html,
    replyTo: settings.contact_email || undefined,
    attachments: [{ filename: `${invoice.invoice_number}.pdf`, content: Buffer.from(pdf).toString('base64') }],
  });
}
