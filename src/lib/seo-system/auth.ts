if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { SeoRole, SeoUser } from './rbac';
import { writeAuditLog } from './audit';

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
export async function ensureDefaultAccounts(): Promise<void> {
  const countRes = await queryOne<{ count: string }>('SELECT count(*) as count FROM public.seo_users');
  if (countRes && parseInt(countRes.count, 10) > 0) return;

  // Create Super Admin
  const adminPass = hashPassword('MigrationFactor2026!');
  const adminRows = await query<{ id: string }>(
    `INSERT INTO public.seo_users (email, name, password_hash, status)
     VALUES ('admin@migrationfactor.com', 'System Admin', $1, 'active')
     RETURNING id`,
    [adminPass]
  );
  if (adminRows[0]) {
    await query(`INSERT INTO public.seo_user_roles (user_id, role_id) VALUES ($1, 'super_admin')`, [adminRows[0].id]);
  }

  // Create Dedicated SEO Specialist / Manager
  const seoPass = hashPassword('SeoSpecialist2026!');
  const seoRows = await query<{ id: string }>(
    `INSERT INTO public.seo_users (email, name, password_hash, status)
     VALUES ('seo@migrationfactor.com', 'Ayesha Khan (SEO Lead)', $1, 'active')
     RETURNING id`,
    [seoPass]
  );
  if (seoRows[0]) {
    await query(`INSERT INTO public.seo_user_roles (user_id, role_id) VALUES ($1, 'seo_manager')`, [seoRows[0].id]);

    // Also link or seed author profile for the reference example (Ayesha Khan)
    await query(
      `INSERT INTO public.seo_authors (user_id, display_name, slug, job_title, bio_short, bio_long, credentials, same_as, expertise, is_reviewer)
       VALUES (
         $1, 
         'Ayesha Khan', 
         'ayesha-khan', 
         'Registered Migration Agent', 
         'Ayesha Khan is a registered migration agent with over 10 years of experience in Australian skilled, employer-sponsored and family visa pathways.',
         'Detailed biographical profile for Ayesha Khan, covering MARA compliance, education consulting, and migration policy analysis.',
         '[{"name": "MARA Registration", "issuer": "OMARA Australia", "year": 2016, "url": "https://www.mara.gov.au"}]'::jsonb,
         '["https://www.linkedin.com/in/ayesha-khan-example"]'::jsonb,
         '["Skills in Demand", "Employer Sponsorship", "General Skilled Migration"]'::jsonb,
         true
       ) ON CONFLICT (slug) DO NOTHING`,
      [seoRows[0].id]
    );
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
  await ensureDefaultAccounts();

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
