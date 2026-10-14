import 'server-only';
import { company } from '@/content/company';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

export type EmailOutcome = 'sent' | 'failed' | 'skipped';

export function notificationRecipient(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL || company.email;
}

function sender(): string {
  return process.env.RESEND_FROM_EMAIL || 'Migration Factor <noreply@migrationfactor.com>';
}

/** Sends through the Resend REST API. Never throws: a failed email must not undo a saved submission. */
export async function sendEmail(message: EmailMessage): Promise<EmailOutcome> {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) return 'skipped';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender(),
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const detail = await response.json().then((body) => body?.name || '').catch(() => '');
      console.warn('Resend rejected an email. Status:', response.status, detail);
      return 'failed';
    }
    return 'sent';
  } catch {
    console.warn('Resend request failed.');
    return 'failed';
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Builds a plain text + HTML table email from label/value rows. */
export function detailEmail(heading: string, rows: [string, string][], footer?: string) {
  const filled = rows.filter(([, value]) => value);
  const text = [heading, '', ...filled.map(([label, value]) => `${label}: ${value}`), ...(footer ? ['', footer] : [])].join('\n');
  const html = `<div style="font-family:Arial,sans-serif;color:#042628;max-width:640px">
<h2 style="color:#0b666a;margin:0 0 16px">${escapeHtml(heading)}</h2>
<table style="border-collapse:collapse;width:100%">${filled
    .map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #d7e6e6;width:180px">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #d7e6e6;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`)
    .join('')}</table>${footer ? `<p style="margin-top:20px;color:#3d5557">${escapeHtml(footer)}</p>` : ''}</div>`;
  return { text, html };
}
