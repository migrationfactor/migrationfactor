import Link from 'next/link';
import Form from 'next/form';
import { requireAdmin } from '@/lib/admin/auth';
import { listHistory } from '@/lib/signatures/service';
import { siteUrl } from '@/lib/signatures/email';
import StatusBadge from '@/components/admin/StatusBadge';
import { formatDateTime } from '@/components/admin/format';
import SignatureRowActions from '@/components/signatures/SignatureRowActions';

export const metadata = { title: 'Signature Requests' };
type Search = Promise<{ tab?: string; q?: string; sent?: string }>;

export default async function SignatureRequestsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const { tab: rawTab, q = '', sent } = await searchParams;
  const tab = rawTab === 'completed' ? 'completed' : 'active';
  const rows = await listHistory(tab, q);
  const base = siteUrl();
  return (
    <>
      <header className="admin-header"><h1>Signature Requests</h1><p>Send documents for e-signature, or sign one yourself.</p></header>
      {sent && <p className="admin-message" role="status">Sent. Signers in the first signing order have been emailed.</p>}
      <div className="sign-start">
        <Link href="/admin/signature-requests/new?mode=send" className="sign-start-card">
          <span className="sign-start-icon" aria-hidden="true">✉</span>
          <strong>Send for Signatures</strong>
          <span>Upload a document, add recipients and place fields for others to sign.</span>
        </Link>
        <Link href="/admin/signature-requests/new?mode=self" className="sign-start-card">
          <span className="sign-start-icon" aria-hidden="true">✍</span>
          <strong>Sign Yourself</strong>
          <span>You are the only signer. Place your fields and sign straight away.</span>
        </Link>
      </div>

      <section className="admin-panel">
        <h2>Signature Requests History</h2>
        <nav className="admin-tabs" aria-label="Request status">
          <Link href={`/admin/signature-requests?tab=active${q ? `&q=${encodeURIComponent(q)}` : ''}`} aria-current={tab === 'active' ? 'page' : undefined}>Pending / Active</Link>
          <Link href={`/admin/signature-requests?tab=completed${q ? `&q=${encodeURIComponent(q)}` : ''}`} aria-current={tab === 'completed' ? 'page' : undefined}>Completed (Executed)</Link>
        </nav>
        <Form className="admin-filters" action="" role="search">
          <input type="hidden" name="tab" value={tab} />
          <label>Search<input type="search" name="q" defaultValue={q} maxLength={80} placeholder="Signer name or email" /></label>
          <button type="submit" className="admin-button">Search</button>
        </Form>
        {rows.length ? <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th scope="col">Signer Info</th><th scope="col">Document Details</th><th scope="col">Order Status</th><th scope="col">Actions</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td data-label="Signer">{r.signer_name}<small>{r.signer_email}{r.role === 'cc' ? ' · receives copy' : ''}</small></td>
              <td data-label="Document">{r.document.name}<small>Created {formatDateTime(r.document.created_at)}</small></td>
              <td data-label="Status"><StatusBadge status={r.status} /><small>Order #{r.signing_order}</small></td>
              <td data-label="Actions"><SignatureRowActions requestId={r.id} documentId={r.document_id} status={r.status} role={r.role}
                link={`${base}/sign/${r.token}`} hasSigned={Boolean(r.document.signed_file_path)} /></td>
            </tr>
          ))}</tbody>
        </table></div> : <div className="admin-empty"><strong>No Signature Requests Found</strong><p>{q ? 'Try a different search.' : 'Start with “Send for Signatures” or “Sign Yourself”.'}</p></div>}
      </section>
    </>
  );
}
