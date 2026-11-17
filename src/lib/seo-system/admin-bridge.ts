import 'server-only';
import { getAdmin } from '@/lib/admin/auth';
import { query, queryOne } from './db';
import { getUserPermissions, SeoRole, SeoUser } from './rbac';

/**
 * Single sign-on between the main admin panel (Supabase auth, `admin_users`) and /seo-admin.
 * A verified main-admin becomes a Super Admin the first time they open the SEO panel; a Super
 * Admin can then lower or disable their SEO role on the Users screen (the main admin login itself
 * is still controlled by `admin_users`). A matching `seo_users` row is
 * kept (by email) because posts, revisions and audit entries reference it; it has no usable
 * password, so the only way in is the main admin login.
 */
const cache = new Map<string, { id: string; at: number }>();

async function ensureSeoUser(email: string): Promise<string> {
  const key = email.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.id;

  let row = await queryOne<{ id: string }>(`SELECT id FROM public.seo_users WHERE lower(email) = $1`, [key]);
  if (!row) {
    row = await queryOne<{ id: string }>(
      `INSERT INTO public.seo_users (email, name, password_hash, status)
       VALUES ($1, $2, '!sso-only', 'active')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [key, key.split('@')[0]]
    );
  } else {
    await query(`UPDATE public.seo_users SET password_hash = '!sso-only' WHERE id = $1 AND password_hash <> '!sso-only'`, [row.id]);
  }
  if (!hit) {
    // Only give the default role to accounts that have no role yet (never override a decision)
    await query(
      `INSERT INTO public.seo_user_roles (user_id, role_id)
       SELECT $1, 'super_admin' WHERE NOT EXISTS (SELECT 1 FROM public.seo_user_roles WHERE user_id = $1)`,
      [row!.id]
    );
  }
  cache.set(key, { id: row!.id, at: Date.now() });
  return row!.id;
}

export async function getMainAdminSeoSession(): Promise<{
  user: SeoUser & { display_name: string; permissions: string[] };
  csrfToken: string;
  session: { id: string; csrfToken: string };
} | null> {
  const admin = await getAdmin();
  if (!admin || !admin.email) return null;
  const id = await ensureSeoUser(admin.email);
  const state = await queryOne<{ status: string; roles: string[] }>(
    `SELECT u.status, COALESCE(array_agg(r.role_id) FILTER (WHERE r.role_id IS NOT NULL), '{}') AS roles
     FROM public.seo_users u LEFT JOIN public.seo_user_roles r ON r.user_id = u.id WHERE u.id = $1 GROUP BY u.id`,
    [id]
  );
  if (!state || state.status !== 'active') return null; // disabled on the Users screen
  const roles = (state.roles.length ? state.roles : ['author']) as SeoRole[];
  const name = admin.email.split('@')[0];
  return {
    user: { id, email: admin.email, name, display_name: name, roles, permissions: getUserPermissions(roles), status: 'active' },
    // Same-origin (Origin header) checks protect state-changing requests for this session type.
    csrfToken: '',
    session: { id: `admin:${admin.userId}`, csrfToken: '' },
  };
}
