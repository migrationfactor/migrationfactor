if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { SeoRole, SeoUser, getUserRoles, getUserPermissions } from './rbac';
import { writeAuditLog } from './audit';
import { getMainAdminSeoSession } from './admin-bridge';

export const SESSION_COOKIE_NAME = 'seo_session_token';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combined: string): boolean {
  const [salt, storedHash] = combined.split(':');
  if (!salt || !storedHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex');
}

/**
 * Ensures default accounts exist (e.g., SEO Manager and Super Admin)
 */
let bootstrapChecked = false;

/**
 * Optional first-run bootstrap. No credentials are hard-coded: an initial Super Admin is only
 * created when SEO_BOOTSTRAP_ADMIN_EMAIL and SEO_BOOTSTRAP_ADMIN_PASSWORD (12+ characters)
 * are set in the environment and the user table is empty. The check runs once per process.
 */
export async function ensureDefaultAccounts(): Promise<void> {
  if (bootstrapChecked) return;
  bootstrapChecked = true;

  const email = process.env.SEO_BOOTSTRAP_ADMIN_EMAIL?.trim();
  const password = process.env.SEO_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return;

  const countRes = await queryOne<{ count: string }>('SELECT count(*) as count FROM public.seo_users');
  if (countRes && parseInt(countRes.count, 10) > 0) return;

  const rows = await query<{ id: string }>(
    `INSERT INTO public.seo_users (email, name, password_hash, status)
     VALUES ($1, 'System Admin', $2, 'active') RETURNING id`,
    [email, hashPassword(password)]
  );
  if (rows[0]) {
    await query(`INSERT INTO public.seo_user_roles (user_id, role_id) VALUES ($1, 'super_admin')`, [rows[0].id]);
  }
}

export async function createSession(userId: string, userAgent?: string, ip?: string): Promise<{ sessionId: string; csrfToken: string }> {
  const sessionId = generateToken(32);
  const csrfToken = generateToken(32);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

  await query(
    `INSERT INTO public.seo_sessions (id, user_id, csrf_token, ip_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, userId, csrfToken, hashIp(ip || ''), userAgent || '', expiresAt]
  );

  return { sessionId, csrfToken };
}

export async function getSessionUser(): Promise<{ user: SeoUser; session: { id: string; csrfToken: string } } | null> {
  // Single sign-on: the main admin session is the only way into the SEO system.
  return getMainAdminSeoSession();
}

async function getLegacySessionUser(): Promise<{ user: SeoUser; session: { id: string; csrfToken: string } } | null> {

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  const row = await queryOne<{
    session_id: string;
    csrf_token: string;
    expires_at: Date;
    revoked_at: Date | null;
    user_id: string;
    email: string;
    name: string;
    status: string;
    roles: string[];
  }>(
    `SELECT 
       s.id as session_id, s.csrf_token, s.expires_at, s.revoked_at,
       u.id as user_id, u.email, u.name, u.status,
       COALESCE(array_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '{}') as roles
     FROM public.seo_sessions s
     JOIN public.seo_users u ON u.id = s.user_id
     LEFT JOIN public.seo_user_roles ur ON ur.user_id = u.id
     WHERE s.id = $1
     GROUP BY s.id, u.id`,
    [sessionToken]
  );

  if (!row) return null;
  if (row.revoked_at || new Date(row.expires_at) < new Date() || row.status !== 'active') {
    return null;
  }

  return {
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      roles: (row.roles || []) as SeoRole[],
      status: row.status,
    },
    session: {
      id: row.session_id,
      csrfToken: row.csrf_token,
    },
  };
}

export async function terminateSession(sessionId: string): Promise<void> {
  await query(`UPDATE public.seo_sessions SET revoked_at = now() WHERE id = $1`, [sessionId]);
}

export async function authenticateSeoUser(
  email: string,
  password: string
): Promise<(SeoUser & { display_name: string; permissions: string[] }) | null> {
  await ensureDefaultAccounts();
  const userRow = await queryOne<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    status: string;
    locked_until: Date | null;
  }>(
    `SELECT id, email, name, password_hash, status, locked_until FROM public.seo_users WHERE lower(email) = lower($1)`,
    [email.trim()]
  );

  if (!userRow || userRow.status !== 'active') return null;

  // SEC-01: back off after repeated failures
  if (userRow.locked_until && new Date(userRow.locked_until) > new Date()) return null;

  const valid = verifyPassword(password, userRow.password_hash);
  if (!valid) {
    await query(
      `UPDATE public.seo_users SET
         failed_logins = failed_logins + 1,
         locked_until = CASE WHEN failed_logins + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
       WHERE id = $1`,
      [userRow.id]
    );
    return null;
  }
  await query(`UPDATE public.seo_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`, [userRow.id]);

  const roles = await getUserRoles(userRow.id);
  const permissions = getUserPermissions(roles);

  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    display_name: userRow.name,
    roles,
    permissions,
    status: userRow.status,
  };
}

export async function createSeoSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionId: string; sessionToken: string; csrfToken: string }> {
  const { sessionId, csrfToken } = await createSession(userId, userAgent, ipAddress);
  return { sessionId, sessionToken: sessionId, csrfToken };
}

export async function revokeSeoSession(sessionIdOrToken: string): Promise<void> {
  await terminateSession(sessionIdOrToken);
}

export async function verifySeoSession(sessionToken?: string): Promise<{
  user: SeoUser & { display_name: string; permissions: string[] };
  csrfToken: string;
  session: { id: string; csrfToken: string };
} | null> {
  // Single sign-on with the main admin panel; the legacy seo_session_token is no longer accepted.
  return getMainAdminSeoSession();
}

async function verifyLegacySeoSession(sessionToken?: string): Promise<{
  user: SeoUser & { display_name: string; permissions: string[] };
  csrfToken: string;
  session: { id: string; csrfToken: string };
} | null> {
  let token = sessionToken;
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      return null;
    }
  }
  if (!token) return null;

  const row = await queryOne<{
    session_id: string;
    csrf_token: string;
    expires_at: Date;
    revoked_at: Date | null;
    user_id: string;
    email: string;
    name: string;
    status: string;
    roles: string[];
  }>(
    `SELECT 
       s.id as session_id, s.csrf_token, s.expires_at, s.revoked_at,
       u.id as user_id, u.email, u.name, u.status,
       COALESCE(array_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '{}') as roles
     FROM public.seo_sessions s
     JOIN public.seo_users u ON u.id = s.user_id
     LEFT JOIN public.seo_user_roles ur ON ur.user_id = u.id
     WHERE s.id = $1
     GROUP BY s.id, u.id`,
    [token]
  );

  if (!row) return null;
  if (row.revoked_at || new Date(row.expires_at) < new Date() || row.status !== 'active') {
    return null;
  }

  const roles = (row.roles || []) as SeoRole[];
  const permissions = getUserPermissions(roles);

  const user = {
    id: row.user_id,
    email: row.email,
    name: row.name,
    display_name: row.name,
    roles,
    permissions,
    status: row.status,
  };

  return {
    user,
    csrfToken: row.csrf_token,
    session: {
      id: row.session_id,
      csrfToken: row.csrf_token,
    },
  };
}
