'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { remindSigner, removeWorkflow, viewSignedDocument } from '@/app/admin/signature-actions';

interface Props { requestId: string; documentId: string; status: string; role: string; link: string; hasSigned: boolean }

export default function SignatureRowActions({ requestId, documentId, status, role, link, hasSigned }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const say = (text: string, error = false) => { setMessage({ text, error }); window.setTimeout(() => setMessage(null), 4000); };

  async function copy() {
    try { await navigator.clipboard.writeText(link); say('Link copied.'); } catch { say('Copy failed. Select the link manually.', true); }
  }
  function remind() {
    startTransition(async () => { const r = await remindSigner(requestId); say(r.message, !r.ok); });
  }
  function viewSigned() {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the short-lived link.
    const tab = window.open('', '_blank');
    startTransition(async () => {
      const r = await viewSignedDocument(documentId);
      if (r.ok && r.url) { if (tab) { tab.opener = null; tab.location.href = r.url; } else window.location.href = r.url; }
      else { tab?.close(); say(r.message, true); }
    });
  }
  function remove() {
    if (!window.confirm('Delete this document and every signature request for it? Signed copies are removed too.')) return;
    startTransition(async () => { const r = await removeWorkflow(documentId); say(r.message, !r.ok); if (r.ok) router.refresh(); });
  }

  return (
    <div className="sign-row-actions">
      {status === 'draft' && <Link className="admin-link-action" href={`/admin/pdf-editor?documentId=${documentId}`}>Edit Layout</Link>}
      {role === 'signer' && status === 'sent' && <button type="button" className="admin-link-action" onClick={copy}>Copy Link</button>}
      {role === 'signer' && status === 'sent' && <button type="button" className="admin-link-action" disabled={pending} onClick={remind}>Remind</button>}
      {hasSigned && <button type="button" className="admin-link-action" disabled={pending} onClick={viewSigned}>View Signed</button>}
      <button type="button" className="admin-link-action danger" disabled={pending} onClick={remove}>Delete</button>
      {message && <span role="status" className={`sign-row-message${message.error ? ' error' : ''}`}>{message.text}</span>}
    </div>
  );
}
