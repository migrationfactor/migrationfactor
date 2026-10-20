import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { getSettings } from '@/lib/invoices/settings';
import { applyFieldValues, isImageField, isToken, MAX_PDF_BYTES, MAX_SIGNATURE_BYTES, sanitizeFields, type SignField } from './fields';
import { mergePdfs, pageCount, stampSignature } from './pdf';
import { sendAdminCopy, sendCompletedCopy, sendInvitation, sendSignedCopy, signingLink } from './email';

// Storage buckets have no policies, so every storage call goes through the secret-key client.
// Table access below also uses it; admin callers are verified with requireAdmin() before any call,
// and public callers are limited to the single request their token identifies.

export type RequestStatus = 'draft' | 'sent' | 'signed' | 'declined' | 'expired';

export interface SignatureRequest {
  id: string; document_id: string; signer_name: string; signer_email: string; role: 'signer' | 'cc'; token: string;
  status: RequestStatus; fields: SignField[]; signing_order: number; signing_message: string | null;
  reminder_interval_days: number | null; last_reminded_at: string | null; signature_url: string | null;
  ip_address: string | null; user_agent: string | null; sent_at: string | null; viewed_at: string | null;
  signed_at: string | null; declined_at: string | null; expires_at: string; created_at: string;
}
export interface SignDocument {
  id: string; template_id: string | null; name: string; file_path: string; signed_file_path: string | null; file_size: number | null;
  page_count: number | null; status: string; email_subject: string | null; email_message: string | null; self_sign: boolean;
  created_by: string | null; completed_at: string | null; created_at: string;
}
export interface Template { id: string; name: string; description: string | null; file_path: string; is_active: boolean; created_at: string }

const db = () => createServiceClient();
const newToken = () => randomBytes(32).toString('hex');
const UPLOAD_PATH = /^uploads\/[0-9a-f-]{36}\.pdf$/;

export async function audit(action: string, entityType: string, entityId: string | null, details: Record<string, unknown>, userId: string | null = null) {
  const { error } = await db().from('audit_logs').insert({ action, entity_type: entityType, entity_id: entityId, details, user_id: userId });
  if (error) console.warn('Audit log failed for', action);
}

async function download(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await db().storage.from(bucket).download(path);
  if (error || !data) throw new Error('The document file could not be read.');
  return new Uint8Array(await data.arrayBuffer());
}

async function upload(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await db().storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error('The file could not be stored.');
}

export async function signedUrl(bucket: string, path: string, seconds: number, download?: string): Promise<string | null> {
  const { data } = await db().storage.from(bucket).createSignedUrl(path, seconds, download ? { download } : undefined);
  return data?.signedUrl ?? null;
}

/** The newest version: the accumulated signed PDF if anyone has signed, otherwise the original. */
function currentFile(doc: Pick<SignDocument, 'file_path' | 'signed_file_path'>): [string, string] {
  return doc.signed_file_path ? ['signed', doc.signed_file_path] : ['documents', doc.file_path];
}

function isPdf(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

// ---------------------------------------------------------------------------
// Admin: setup
// ---------------------------------------------------------------------------
/** One-time upload slots so large PDFs go straight from the browser to private storage. */
export async function createUploadTargets(count: number) {
  const targets = [];
  for (let i = 0; i < Math.min(Math.max(count, 1), 10); i++) {
    const path = `uploads/${randomUUID()}.pdf`;
    const { data, error } = await db().storage.from('documents').createSignedUploadUrl(path);
    if (error || !data) throw new Error('Upload could not be prepared.');
    targets.push({ path, url: data.signedUrl });
  }
  return targets;
}

export interface RecipientInput { name: string; email: string; role: 'signer' | 'cc'; order: number; message: string }
export interface WorkflowInput {
  source: { kind: 'upload'; paths: string[] } | { kind: 'document'; id: string } | { kind: 'template'; id: string };
  name: string;
  recipients: RecipientInput[];
  subject: string;
  message: string;
  expiryDays: number;
  reminderDays: number | null;
  selfSign: boolean;
  saveAsTemplate: boolean;
}

export async function createWorkflow(input: WorkflowInput, adminId: string): Promise<string> {
  let bytes: Uint8Array;
  let templateId: string | null = null;
  if (input.source.kind === 'upload') {
    const paths = input.source.paths;
    if (!paths.length || paths.length > 10 || !paths.every((p) => UPLOAD_PATH.test(p))) throw new Error('Upload the PDF again.');
    const files = await Promise.all(paths.map((p) => download('documents', p)));
    if (!files.every((f) => isPdf(f) && f.length <= MAX_PDF_BYTES)) throw new Error('Only PDF files up to 20 MB can be used.');
    bytes = await mergePdfs(files);
    await db().storage.from('documents').remove(paths);
  } else if (input.source.kind === 'document') {
    const { data } = await db().from('documents').select('file_path, signed_file_path').eq('id', input.source.id).maybeSingle();
    if (!data) throw new Error('The client file was not found.');
    bytes = await download(...currentFile(data));
  } else {
    const { data } = await db().from('document_templates').select('id, file_path').eq('id', input.source.id).eq('is_active', true).maybeSingle();
    if (!data) throw new Error('The template was not found.');
    templateId = data.id;
    bytes = await download('templates', data.file_path);
  }

  let pages: number;
  try { pages = await pageCount(bytes); } catch { throw new Error('The PDF could not be opened. It may be damaged or password-protected.'); }
  const documentId = randomUUID();
  const filePath = `originals/${documentId}.pdf`;
  await upload('documents', filePath, bytes, 'application/pdf');

  if (input.saveAsTemplate && input.source.kind === 'upload') {
    const templatePath = `${randomUUID()}.pdf`;
    await upload('templates', templatePath, bytes, 'application/pdf');
    const { data } = await db().from('document_templates').insert({ name: input.name, file_path: templatePath }).select('id').single();
    templateId = data?.id ?? null;
  }

  const { error } = await db().from('documents').insert({
    id: documentId, template_id: templateId, name: input.name, file_path: filePath, file_size: bytes.length, page_count: pages,
    email_subject: input.subject || null, email_message: input.message || null, self_sign: input.selfSign, created_by: adminId,
  });
  if (error) throw new Error('The document could not be saved.');

  const expiresAt = new Date(Date.now() + input.expiryDays * 86400000).toISOString();
  const rows = input.recipients.map((r) => ({
    document_id: documentId, signer_name: r.name, signer_email: r.email.toLowerCase(), role: r.role, token: newToken(),
    status: 'draft', signing_order: r.order, signing_message: r.message || null,
    reminder_interval_days: r.role === 'signer' ? input.reminderDays : null, expires_at: expiresAt,
  }));
  const { data: inserted, error: requestError } = await db().from('signature_requests').insert(rows).select('id, signer_email, role');
  if (requestError || !inserted) {
    await db().from('documents').delete().eq('id', documentId);
    throw new Error('The recipients could not be saved.');
  }
  await Promise.all(inserted.map((r) => audit('signature_requested', 'signature_request', r.id, { document_id: documentId, signer_email: r.signer_email, role: r.role }, adminId)));
  return documentId;
}

export async function listSetupSources() {
  const [docs, templates] = await Promise.all([
    db().from('documents').select('id, name, created_at').eq('status', 'approved').order('created_at', { ascending: false }).limit(200),
    db().from('document_templates').select('id, name, description').eq('is_active', true).order('name'),
  ]);
  return { documents: docs.data ?? [], templates: templates.data ?? [] };
}

// ---------------------------------------------------------------------------
// Admin: editor
// ---------------------------------------------------------------------------
export async function getEditorData(documentId: string) {
  const { data: doc } = await db().from('documents').select('*').eq('id', documentId).maybeSingle();
  if (!doc) return null;
  const { data: requests } = await db().from('signature_requests').select('*').eq('document_id', documentId).order('signing_order').order('created_at');
  const url = await signedUrl('documents', doc.file_path, 3600);
  return { document: doc as SignDocument, requests: (requests ?? []) as SignatureRequest[], url };
}

/** Stores fields for draft signers only; anything already sent keeps its layout. */
export async function saveFields(documentId: string, layout: { id: string; fields: unknown }[]) {
  const { data: doc } = await db().from('documents').select('page_count').eq('id', documentId).maybeSingle();
  if (!doc) throw new Error('Document not found.');
  const { data: requests } = await db().from('signature_requests').select('id, role, status').eq('document_id', documentId);
  const editable = new Map((requests ?? []).filter((r) => r.status === 'draft' && r.role === 'signer').map((r) => [r.id, r]));
  const saved: Record<string, SignField[]> = {};
  for (const item of layout) {
    if (!editable.has(item.id)) continue;
    const fields = sanitizeFields(item.fields, doc.page_count ?? 1);
    const { error } = await db().from('signature_requests').update({ fields }).eq('id', item.id).eq('status', 'draft');
    if (error) throw new Error('The layout could not be saved.');
    saved[item.id] = fields;
  }
  return saved;
}

export async function activateRequests(documentId: string, layout: { id: string; fields: unknown }[], adminId: string) {
  const saved = await saveFields(documentId, layout);
  const { data: doc } = await db().from('documents').select('*').eq('id', documentId).maybeSingle();
  const { data: requests } = await db().from('signature_requests').select('*').eq('document_id', documentId);
  if (!doc || !requests) throw new Error('Document not found.');
  const signers = (requests as SignatureRequest[]).filter((r) => r.role === 'signer');
  if (!signers.length) throw new Error('Add at least one signer.');
  const missing = signers.find((r) => r.status === 'draft' && !(saved[r.id] ?? r.fields).some((f) => isImageField(f.type)));
  if (missing) throw new Error(`Place a signature or initial field for ${missing.signer_name}.`);
  if (signers.some((r) => r.status !== 'draft')) throw new Error('This document has already been sent.');
  return startNextGroup(doc as SignDocument, adminId);
}

/** Sends the lowest signing-order group of draft signers; later groups wait until it is finished. */
async function startNextGroup(doc: SignDocument, actorId: string | null): Promise<{ sent: string[]; selfSignToken: string | null }> {
  const { data } = await db().from('signature_requests').select('*').eq('document_id', doc.id).eq('role', 'signer').eq('status', 'draft').order('signing_order');
  const drafts = (data ?? []) as SignatureRequest[];
  if (!drafts.length) return { sent: [], selfSignToken: null };
  const order = drafts[0].signing_order;
  const group = drafts.filter((r) => r.signing_order === order);
  const now = new Date().toISOString();
  const settings = await getSettings();
  for (const request of group) {
    await db().from('signature_requests').update({ status: 'sent', sent_at: now }).eq('id', request.id).eq('status', 'draft');
    if (!doc.self_sign) {
      const outcome = await sendInvitation({
        business: settings.business_name, to: request.signer_email, name: request.signer_name, documentName: doc.name, token: request.token,
        expiresAt: request.expires_at, subject: doc.email_subject, message: doc.email_message, privateMessage: request.signing_message,
        replyTo: settings.contact_email || undefined,
      });
      await audit('signature_sent', 'signature_request', request.id, { email: outcome, signing_order: order }, actorId);
    }
  }
  return { sent: group.map((r) => r.signer_email), selfSignToken: doc.self_sign ? group[0].token : null };
}

// ---------------------------------------------------------------------------
// Admin: history and actions
// ---------------------------------------------------------------------------
export async function listHistory(tab: 'active' | 'completed', q: string) {
  const term = q.replace(/[%_,()*\\:."']/g, ' ').trim().slice(0, 80);
  let query = db().from('signature_requests')
    .select('id, document_id, signer_name, signer_email, role, token, status, signing_order, expires_at, created_at, signed_at, documents!inner(name, created_at, signed_file_path, self_sign)')
    .order('created_at', { ascending: false }).limit(300);
  query = tab === 'completed' ? query.in('status', ['signed', 'declined', 'expired']) : query.in('status', ['draft', 'sent']);
  if (term) query = query.or(`signer_name.ilike.%${term}%,signer_email.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error('Could not load signature requests.');
  const now = Date.now();
  return (data ?? []).map((r) => {
    const doc = (Array.isArray(r.documents) ? r.documents[0] : r.documents) as { name: string; created_at: string; signed_file_path: string | null; self_sign: boolean };
    const expired = r.status === 'sent' && Date.parse(r.expires_at) < now;
    return { ...r, documents: undefined, document: doc, status: (expired ? 'expired' : r.status) as RequestStatus };
  }).filter((r) => tab === 'completed' || r.status !== 'expired');
}

export async function sendReminder(requestId: string, actorId: string | null) {
  const { data: request } = await db().from('signature_requests').select('*, documents(name, email_subject, email_message)').eq('id', requestId).maybeSingle();
  if (!request || request.status !== 'sent') throw new Error('Only requests waiting for a signature can be reminded.');
  if (Date.parse(request.expires_at) < Date.now()) throw new Error('This signing link has expired.');
  const doc = request.documents as { name: string; email_subject: string | null; email_message: string | null };
  const settings = await getSettings();
  const outcome = await sendInvitation({
    business: settings.business_name, to: request.signer_email, name: request.signer_name, documentName: doc.name, token: request.token,
    expiresAt: request.expires_at, subject: doc.email_subject, message: doc.email_message, privateMessage: request.signing_message,
    reminder: true, replyTo: settings.contact_email || undefined,
  });
  await db().from('signature_requests').update({ last_reminded_at: new Date().toISOString() }).eq('id', requestId);
  await audit('signature_reminded', 'signature_request', requestId, { email: outcome }, actorId);
  return outcome;
}

export async function signedDocumentUrl(documentId: string): Promise<string | null> {
  const { data } = await db().from('documents').select('name, signed_file_path').eq('id', documentId).maybeSingle();
  if (!data?.signed_file_path) return null;
  return signedUrl('signed', data.signed_file_path, 120);
}

export async function deleteWorkflow(documentId: string) {
  const { data } = await db().from('documents').select('file_path, signed_file_path').eq('id', documentId).maybeSingle();
  if (!data) return;
  const { data: requests } = await db().from('signature_requests').select('signature_url').eq('document_id', documentId);
  await db().from('documents').delete().eq('id', documentId);
  await db().storage.from('documents').remove([data.file_path]);
  const { data: versions } = await db().storage.from('signed').list(`admin/${documentId}`);
  if (versions?.length) await db().storage.from('signed').remove(versions.map((v) => `admin/${documentId}/${v.name}`));
  const sigs = (requests ?? []).map((r) => r.signature_url).filter(Boolean) as string[];
  if (sigs.length) await db().storage.from('signatures').remove(sigs);
}

// ---------------------------------------------------------------------------
// Public signing (token only)
// ---------------------------------------------------------------------------
export async function getRequestByToken(token: string) {
  if (!isToken(token)) return null;
  const { data } = await db().from('signature_requests').select('*, documents(*)').eq('token', token).maybeSingle();
  if (!data) return null;
  const document = (Array.isArray(data.documents) ? data.documents[0] : data.documents) as SignDocument;
  const request = { ...data, documents: undefined } as unknown as SignatureRequest;
  const isExpired = Date.parse(request.expires_at) < Date.now();
  return { request, document, isExpired };
}

/** Only what the signer needs: their own fields and a 1-hour link to this request's PDF. */
export async function publicSigningView(token: string) {
  const found = await getRequestByToken(token);
  if (!found) return null;
  const { request, document, isExpired } = found;
  let state: 'ready' | 'expired' | 'signed' | 'declined' | 'unavailable' = 'ready';
  if (request.role !== 'signer' || request.status === 'draft') state = 'unavailable';
  else if (request.status === 'signed') state = 'signed';
  else if (request.status === 'declined') state = 'declined';
  else if (request.status === 'expired' || isExpired) state = 'expired';
  if (state === 'expired' && request.status === 'sent') await db().from('signature_requests').update({ status: 'expired' }).eq('id', request.id).eq('status', 'sent');
  if (state === 'ready' && !request.viewed_at) {
    await db().from('signature_requests').update({ viewed_at: new Date().toISOString() }).eq('id', request.id);
  }
  const url = state === 'ready' ? await signedUrl(...currentFile(document), 3600) : null;
  return {
    state,
    signerName: request.signer_name,
    signerEmail: request.signer_email,
    documentName: document.name,
    expiresAt: request.expires_at,
    fields: state === 'ready' ? request.fields : [],
    pdfUrl: url,
  };
}

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;
/** Decodes a PNG data URL, rejecting anything else or anything over 2 MB. */
export function decodePngDataUrl(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || value.length > MAX_SIGNATURE_BYTES * 1.4) return null;
  const match = PNG_DATA_URL.exec(value);
  if (!match) return null;
  const bytes = new Uint8Array(Buffer.from(match[1], 'base64'));
  if (bytes.length > MAX_SIGNATURE_BYTES || bytes.length < 8) return null;
  return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b) ? bytes : null;
}

export class SigningError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function signDocument(token: string, input: { signaturePng: unknown; initialPng: unknown; fieldValues: unknown }, meta: { ip: string; userAgent: string }) {
  const found = await getRequestByToken(token);
  if (!found) throw new SigningError('This signing link is not valid.', 404);
  const { request, document, isExpired } = found;
  if (request.role !== 'signer' || request.status !== 'sent') throw new SigningError('This document is not waiting for your signature.', 409);
  if (isExpired) throw new SigningError('This signing link has expired.', 410);

  const signaturePng = decodePngDataUrl(input.signaturePng);
  if (!signaturePng) throw new SigningError('Add your signature (PNG, up to 2 MB).', 422);
  const initialPng = input.initialPng ? decodePngDataUrl(input.initialPng) : null;
  if (input.initialPng && !initialPng) throw new SigningError('The initials image is not valid.', 422);
  const { fields, missing } = applyFieldValues(request.fields, input.fieldValues, true, Boolean(initialPng));
  if (missing) throw new SigningError(`Complete every required field (${missing.label || missing.type.replace('_', ' ')} on page ${missing.page}).`, 422);

  const signedAt = new Date();
  const settings = await getSettings();
  const signaturePath = `${request.id}_sig.png`;
  await upload('signatures', signaturePath, signaturePng, 'image/png');

  // Claim the request first so a double submission cannot stamp twice.
  const { data: claimed } = await db().from('signature_requests').update({
    status: 'signed', signature_url: signaturePath, signed_at: signedAt.toISOString(), ip_address: meta.ip.slice(0, 80),
    user_agent: meta.userAgent.slice(0, 400), fields,
  }).eq('id', request.id).eq('status', 'sent').select('id');
  if (!claimed?.length) throw new SigningError('This document is not waiting for your signature.', 409);

  // Stamp onto the newest version; retry if another signer saved a version in the meantime.
  let latestPath = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: current } = await db().from('documents').select('file_path, signed_file_path, updated_at').eq('id', document.id).single();
    if (!current) throw new SigningError('The document no longer exists.', 404);
    const stamped = await stampSignature(await download(...currentFile(current)), {
      fields, signaturePng, initialPng, signer: { name: request.signer_name, email: request.signer_email },
      audit: { signedAt, ip: meta.ip, documentId: document.id, requestId: request.id, businessName: settings.business_name },
    });
    const path = `admin/${document.id}/${Date.now()}-${request.id.slice(0, 8)}.pdf`;
    await upload('signed', path, stamped, 'application/pdf');
    const { data: swapped } = await db().from('documents')
      .update({ signed_file_path: path, file_size: stamped.length })
      .eq('id', document.id).eq('updated_at', current.updated_at).select('id');
    if (swapped?.length) { latestPath = path; break; }
    await db().storage.from('signed').remove([path]);
  }
  if (!latestPath) {
    await db().from('signature_requests').update({ status: 'sent', signature_url: null, signed_at: null }).eq('id', request.id);
    throw new SigningError('The document is busy. Please submit again.', 503);
  }

  await audit('signature_signed', 'signature_request', request.id, { document_id: document.id, ip: meta.ip, user_agent: meta.userAgent.slice(0, 400) });

  // Sequential signing: when this order group is finished, notify the next one.
  const { data: siblings } = await db().from('signature_requests').select('role, status, signing_order').eq('document_id', document.id);
  const signers = (siblings ?? []).filter((r) => r.role === 'signer');
  const groupOpen = signers.some((r) => r.signing_order === request.signing_order && r.status === 'sent');
  if (!groupOpen) await startNextGroup(document, null);
  const complete = signers.every((r) => r.status === 'signed');
  if (complete) await db().from('documents').update({ status: 'approved', completed_at: new Date().toISOString() }).eq('id', document.id);

  const downloadUrl = await signedUrl('signed', latestPath, 7 * 86400, `${document.name.replace(/[^\w .-]+/g, '').slice(0, 80) || 'document'}-signed.pdf`);
  if (downloadUrl) {
    const replyTo = settings.contact_email || undefined;
    await Promise.allSettled([
      sendSignedCopy({ business: settings.business_name, to: request.signer_email, name: request.signer_name, documentName: document.name, downloadUrl, replyTo }),
      sendAdminCopy({ business: settings.business_name, signerName: request.signer_name, signerEmail: request.signer_email, documentName: document.name, downloadUrl, complete }),
      ...(complete ? [notifyCopyRecipients(document, downloadUrl, settings.business_name, replyTo)] : []),
    ]);
  }
  return { complete };
}

async function notifyCopyRecipients(document: SignDocument, downloadUrl: string, business: string, replyTo?: string) {
  const { data } = await db().from('signature_requests').select('id, signer_name, signer_email').eq('document_id', document.id).eq('role', 'cc');
  for (const cc of data ?? []) {
    await sendCompletedCopy({ business, to: cc.signer_email, name: cc.signer_name, documentName: document.name, downloadUrl, replyTo });
    await db().from('signature_requests').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('id', cc.id);
  }
}

export async function declineSignatureRequest(token: string, meta: { ip: string; userAgent: string }) {
  const found = await getRequestByToken(token);
  if (!found) throw new SigningError('This signing link is not valid.', 404);
  const { request, isExpired } = found;
  if (request.status !== 'sent' || isExpired) throw new SigningError('This document is not waiting for your signature.', 409);
  const { data } = await db().from('signature_requests').update({ status: 'declined', declined_at: new Date().toISOString(), ip_address: meta.ip.slice(0, 80), user_agent: meta.userAgent.slice(0, 400) })
    .eq('id', request.id).eq('status', 'sent').select('id');
  if (!data?.length) throw new SigningError('This document is not waiting for your signature.', 409);
  await audit('signature_declined', 'signature_request', request.id, { document_id: request.document_id, ip: meta.ip });
}

// ---------------------------------------------------------------------------
// Scheduled job
// ---------------------------------------------------------------------------
export async function runScheduledReminders() {
  const now = Date.now();
  const { data } = await db().from('signature_requests').select('id, expires_at, reminder_interval_days, sent_at, last_reminded_at').eq('status', 'sent').eq('role', 'signer');
  let reminded = 0;
  let expired = 0;
  for (const r of data ?? []) {
    if (Date.parse(r.expires_at) < now) {
      await db().from('signature_requests').update({ status: 'expired' }).eq('id', r.id).eq('status', 'sent');
      expired++;
      continue;
    }
    if (!r.reminder_interval_days) continue;
    const last = Date.parse(r.last_reminded_at || r.sent_at || '');
    if (Number.isFinite(last) && now - last >= r.reminder_interval_days * 86400000 - 3600000) {
      await sendReminder(r.id, null).catch(() => undefined);
      reminded++;
    }
  }
  return { reminded, expired };
}

export { signingLink };
