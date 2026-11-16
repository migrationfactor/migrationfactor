if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}

import { query } from './db';

export interface AuditLogEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

const REDACTED_KEYS = new Set([
  'password',
  'password_hash',
  'mfa_secret_enc',
  'encrypted_payload',
  'token',
  'csrf_token',
  'authorization',
  'secret',
  'api_key',
  'key',
]);

function sanitizeRecord(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeRecord);

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes('secret') || key.toLowerCase().includes('password')) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeRecord(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Append-only audit logger per SEC-09 and Core Product Principle 3.
 * Logs all content, SEO, robots, canonical, sitemap, credential, and permission changes with before/after diffs.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const cleanBefore = entry.before ? sanitizeRecord(entry.before) : null;
    const cleanAfter = entry.after ? sanitizeRecord(entry.after) : null;

    await query(
      `INSERT INTO public.seo_audit_logs 
       (actor_id, actor_role, action, entity_type, entity_id, before, after, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.actorId || null,
        entry.actorRole || null,
        entry.action,
        entry.entityType,
        entry.entityId || null,
        cleanBefore ? JSON.stringify(cleanBefore) : null,
        cleanAfter ? JSON.stringify(cleanAfter) : null,
        entry.ipHash || null,
        entry.userAgent || null,
      ]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
    // Audit logging failure should not crash the request, but must be alerted
  }
}
