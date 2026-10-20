'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { expiryOptions, reminderOptions } from '@/lib/signatures/fields';
import {
  activateRequests, createUploadTargets, createWorkflow, deleteWorkflow, saveFields, sendReminder, signedDocumentUrl,
  type RecipientInput, type WorkflowInput,
} from '@/lib/signatures/service';

export interface SignatureActionResult {
  ok: boolean;
  message: string;
  documentId?: string;
  url?: string;
  selfSignToken?: string | null;
  targets?: { path: string; url: string }[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (error: unknown, fallback: string): SignatureActionResult => ({ ok: false, message: error instanceof Error ? error.message : fallback });

export async function prepareUploads(count: number): Promise<SignatureActionResult> {
  await requireAdmin();
  try {
    return { ok: true, message: '', targets: await createUploadTargets(Number(count) || 1) };
  } catch (error) { return fail(error, 'Upload could not be prepared.'); }
}

/** Validates the setup form on the server, then creates the document and one draft request per recipient. */
export async function createSignWorkflow(payload: unknown): Promise<SignatureActionResult> {
  const admin = await requireAdmin();
  const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const source = (raw.source && typeof raw.source === 'object' ? raw.source : {}) as Record<string, unknown>;
  let parsedSource: WorkflowInput['source'];
  if (source.kind === 'upload' && Array.isArray(source.paths)) parsedSource = { kind: 'upload', paths: source.paths.filter((p): p is string => typeof p === 'string') };
  else if ((source.kind === 'document' || source.kind === 'template') && typeof source.id === 'string' && uuid.test(source.id)) parsedSource = { kind: source.kind, id: source.id };
  else return { ok: false, message: 'Choose a document.' };

  const name = str(raw.name, 200);
  if (!name) return { ok: false, message: 'Enter the document name.' };
  const sequential = raw.sequential === true;
  const recipients: RecipientInput[] = (Array.isArray(raw.recipients) ? raw.recipients.slice(0, 20) : []).map((r, i) => {
    const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return { name: str(row.name, 160), email: str(row.email, 254).toLowerCase(), role: row.role === 'cc' ? 'cc' : 'signer', order: sequential ? i + 1 : 1, message: str(row.message, 1000) };
  });
  if (!recipients.some((r) => r.role === 'signer')) return { ok: false, message: 'Add at least one recipient who needs to sign.' };
  const invalid = recipients.find((r) => r.name.length < 2 || !emailPattern.test(r.email));
  if (invalid) return { ok: false, message: 'Every recipient needs a full name and a valid email address.' };
  const emails = recipients.map((r) => r.email);
  if (new Set(emails).size !== emails.length) return { ok: false, message: 'Each recipient must have a different email address.' };

  const expiryDays = Number(raw.expiryDays);
  const reminderDays = raw.reminderDays === null ? null : Number(raw.reminderDays);
  try {
    const documentId = await createWorkflow({
      source: parsedSource, name, recipients,
      subject: str(raw.subject, 200), message: str(raw.message, 2000),
      expiryDays: (expiryOptions as readonly number[]).includes(expiryDays) ? expiryDays : 15,
      reminderDays: reminderOptions.some(([v]) => v === reminderDays) ? reminderDays : 5,
      selfSign: raw.selfSign === true,
      saveAsTemplate: raw.saveAsTemplate === true,
    }, admin.userId);
    revalidatePath('/admin/signature-requests');
    return { ok: true, message: 'Document ready. Place the fields next.', documentId };
  } catch (error) { return fail(error, 'The workflow could not be created.'); }
}

function readLayout(layout: unknown) {
  return (Array.isArray(layout) ? layout : [])
    .filter((item): item is { id: string; fields: unknown } => Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' && uuid.test((item as { id: string }).id));
}

export async function saveLayout(documentId: string, layout: unknown): Promise<SignatureActionResult> {
  await requireAdmin();
  if (!uuid.test(documentId)) return { ok: false, message: 'Invalid document.' };
  try {
    await saveFields(documentId, readLayout(layout));
    return { ok: true, message: 'Draft saved.' };
  } catch (error) { return fail(error, 'The layout could not be saved.'); }
}

export async function sendForSignature(documentId: string, layout: unknown): Promise<SignatureActionResult> {
  const admin = await requireAdmin();
  if (!uuid.test(documentId)) return { ok: false, message: 'Invalid document.' };
  try {
    const result = await activateRequests(documentId, readLayout(layout), admin.userId);
    revalidatePath('/admin/signature-requests');
    return {
      ok: true,
      selfSignToken: result.selfSignToken,
      message: result.selfSignToken ? 'Ready for your signature.' : `Sent to ${result.sent.join(', ')}.`,
    };
  } catch (error) { return fail(error, 'The document could not be sent.'); }
}

export async function remindSigner(requestId: string): Promise<SignatureActionResult> {
  const admin = await requireAdmin();
  if (!uuid.test(requestId)) return { ok: false, message: 'Invalid request.' };
  try {
    const outcome = await sendReminder(requestId, admin.userId);
    return { ok: outcome === 'sent', message: outcome === 'sent' ? 'Reminder sent.' : `The reminder email was not sent (${outcome}).` };
  } catch (error) { return fail(error, 'The reminder could not be sent.'); }
}

/** A 2-minute link to the latest signed PDF. */
export async function viewSignedDocument(documentId: string): Promise<SignatureActionResult> {
  await requireAdmin();
  if (!uuid.test(documentId)) return { ok: false, message: 'Invalid document.' };
  const url = await signedDocumentUrl(documentId);
  return url ? { ok: true, message: '', url } : { ok: false, message: 'Nobody has signed this document yet.' };
}

export async function removeWorkflow(documentId: string): Promise<SignatureActionResult> {
  await requireAdmin();
  if (!uuid.test(documentId)) return { ok: false, message: 'Invalid document.' };
  try {
    await deleteWorkflow(documentId);
    revalidatePath('/admin/signature-requests');
    return { ok: true, message: 'Document and its requests deleted.' };
  } catch (error) { return fail(error, 'The document could not be deleted.'); }
}
