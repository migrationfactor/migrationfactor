import 'server-only';
import { escapeHtml, notificationRecipient, sendEmail, type EmailOutcome } from '@/lib/email/resend';
import { SITE_URL } from '@/lib/constants';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/$/, '');
}

export function signingLink(token: string): string {
  return `${siteUrl()}/sign/${token}`;
}

/** Branded shell shared by every signature email; the button is the only call to action. */
function layout(business: string, heading: string, paragraphs: string[], button: { label: string; href: string }, note?: string) {
  const html = `<div style="font-family:Arial,sans-serif;color:#042628;max-width:600px;margin:auto">
<div style="background:#0b666a;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;font-size:20px;font-weight:bold">${escapeHtml(business)}</div>
<div style="border:1px solid #d7e6e6;border-top:0;padding:28px 24px;border-radius:0 0 10px 10px">
<h1 style="font-size:22px;margin:0 0 16px;color:#042628">${escapeHtml(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(p)}</p>`).join('')}
<p style="margin:26px 0;text-align:center"><a href="${escapeHtml(button.href)}" style="background:#0b666a;color:#fff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;display:inline-block">${escapeHtml(button.label)}</a></p>
${note ? `<p style="margin:0;color:#a01b2b;font-size:13px">${escapeHtml(note)}</p>` : ''}
<p style="margin:22px 0 0;color:#3d5557;font-size:12px">If the button does not work, copy this link into your browser:<br>${escapeHtml(button.href)}</p>
</div></div>`;
  const text = [heading, '', ...paragraphs, '', `${button.label}: ${button.href}`, ...(note ? ['', note] : [])].join('\n');
  return { html, text };
}

export async function sendInvitation(args: {
  business: string; to: string; name: string; documentName: string; token: string; expiresAt: string;
  subject?: string | null; message?: string | null; privateMessage?: string | null; reminder?: boolean; replyTo?: string;
}): Promise<EmailOutcome> {
  const days = Math.max(1, Math.ceil((Date.parse(args.expiresAt) - Date.now()) / 86400000));
  const heading = args.reminder ? 'Urgent Signature Reminder' : 'Signature Requested';
  const paragraphs = [
    `Dear ${args.name},`,
    args.reminder
      ? `This is a reminder that "${args.documentName}" from ${args.business} is still waiting for your signature.`
      : `${args.business} has sent you "${args.documentName}" to review and sign electronically.`,
    ...(args.message ? [args.message] : []),
    ...(args.privateMessage ? [`Note for you: ${args.privateMessage}`] : []),
  ];
  const { html, text } = layout(args.business, heading, paragraphs, { label: 'Review and Sign Document', href: signingLink(args.token) },
    `This link will expire in ${days} day${days === 1 ? '' : 's'}.`);
  const subject = args.reminder ? `Reminder: ${args.subject || `Please sign ${args.documentName}`}` : (args.subject || `Please sign: ${args.documentName}`);
  return sendEmail({ to: args.to, subject, html, text, replyTo: args.replyTo });
}

export async function sendSignedCopy(args: { business: string; to: string; name: string; documentName: string; downloadUrl: string; replyTo?: string }): Promise<EmailOutcome> {
  const { html, text } = layout(args.business, 'Your document is signed', [
    `Dear ${args.name},`,
    `Thank you. "${args.documentName}" has been signed. You can download your copy below.`,
  ], { label: 'Download Signed Document', href: args.downloadUrl }, 'This download link expires in 7 days. Save a copy for your records.');
  return sendEmail({ to: args.to, subject: `Signed: ${args.documentName}`, html, text, replyTo: args.replyTo });
}

export async function sendAdminCopy(args: { business: string; signerName: string; signerEmail: string; documentName: string; downloadUrl: string; complete: boolean }): Promise<EmailOutcome> {
  const { html, text } = layout(args.business, `Signed copy from ${args.signerName}`, [
    `${args.signerName} (${args.signerEmail}) signed "${args.documentName}".`,
    args.complete ? 'All signers have now signed this document.' : 'Other signers have not finished yet; the next signer has been notified if signing in order.',
  ], { label: 'Download Signed Document', href: args.downloadUrl }, 'This download link expires in 7 days.');
  return sendEmail({ to: notificationRecipient(), subject: `Signed copy from ${args.signerName}: ${args.documentName}`, html, text, replyTo: args.signerEmail });
}

export async function sendCompletedCopy(args: { business: string; to: string; name: string; documentName: string; downloadUrl: string; replyTo?: string }): Promise<EmailOutcome> {
  const { html, text } = layout(args.business, 'Document completed', [
    `Dear ${args.name},`,
    `"${args.documentName}" has been signed by everyone. A copy is shared with you below.`,
  ], { label: 'Download Signed Document', href: args.downloadUrl }, 'This download link expires in 7 days.');
  return sendEmail({ to: args.to, subject: `Completed: ${args.documentName}`, html, text, replyTo: args.replyTo });
}
