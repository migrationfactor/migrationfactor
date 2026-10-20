import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isToken } from '@/lib/signatures/fields';
import { publicSigningView } from '@/lib/signatures/service';
import { getSettings } from '@/lib/invoices/settings';
import SigningClient from '@/components/signatures/SigningClient';
import '@/styles/signing.css';

export const metadata: Metadata = { title: 'Sign document', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

const messages = {
  expired: ['Signing Link Expired', 'This signing link has expired. Contact the sender for a new link.'],
  signed: ['Document Signed', 'You have already signed this document. A copy was emailed to you.'],
  declined: ['Workflow Declined', 'You declined to sign this document. The sender has been notified in their dashboard.'],
  unavailable: ['Portal Error', 'This document is not ready for signing yet. Contact the sender.'],
} as const;

/** Public page, gated only by the 64-character token in the link. */
export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const [view, settings] = await Promise.all([publicSigningView(token), getSettings()]);
  if (!view) notFound();
  if (view.state !== 'ready') {
    const [title, text] = messages[view.state];
    return <div className="signing-shell"><div className="signing-state"><h1>{title}</h1><p>{text}</p><p className="signing-doc-name">{view.documentName}</p></div></div>;
  }
  return <SigningClient token={token} business={settings.business_name} documentName={view.documentName} signerName={view.signerName}
    signerEmail={view.signerEmail} expiresInDays={Math.max(0, Math.ceil((Date.parse(view.expiresAt) - Date.now()) / 86400000))} fields={view.fields} pdfUrl={view.pdfUrl} />;
}
