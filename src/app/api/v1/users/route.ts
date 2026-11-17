import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';

const ROLES = ['super_admin', 'admin', 'seo_manager', 'editor', 'author'];

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'users.manage');
  if (errorResponse) return errorResponse;
  const rows = await query(
    `SELECT u.id, u.email, u.name, u.status, u.last_login_at, u.created_at,
            COALESCE(array_agg(r.role_id) FILTER (WHERE r.role_id IS NOT NULL), '{}') AS roles
     FROM public.seo_users u LEFT JOIN public.seo_user_roles r ON r.user_id = u.id
     WHERE u.password_hash = '!sso-only'
     GROUP BY u.id ORDER BY u.created_at`
  );
  return NextResponse.json({ users: rows, roles: ROLES });
}

/**
 * Changes a person's SEO role or enables/disables their access. Sign-in itself stays with the main
 * admin login (`admin_users`). Guards: you cannot demote or disable yourself, and the last active
 * Super Admin can never be removed.
 */
export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'users.manage');
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => ({}));
  const target = await queryOne<any>(
    `SELECT u.id, u.email, u.status, COALESCE(array_agg(r.role_id) FILTER (WHERE r.role_id IS NOT NULL), '{}') AS roles
     FROM public.seo_users u LEFT JOIN public.seo_user_roles r ON r.user_id = u.id WHERE u.id = $1 GROUP BY u.id`,
    [body.id]
  );
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const actorRoles: string[] = auth!.user.roles || [];
  const actorIsSuper = actorRoles.includes('super_admin');
  const newRole: string | undefined = body.role;
  const newStatus: string | undefined = body.status;

  if (newRole !== undefined && !ROLES.includes(newRole)) return NextResponse.json({ error: 'invalid_role' }, { status: 422 });
  if (newStatus !== undefined && !['active', 'disabled'].includes(newStatus)) return NextResponse.json({ error: 'invalid_status' }, { status: 422 });
  // Admins cannot touch Super Admins or hand out the Super Admin role (Section 18.1)
  if (!actorIsSuper && (target.roles.includes('super_admin') || newRole === 'super_admin')) {
    return NextResponse.json({ error: 'forbidden', message: 'Only a Super Admin can change Super Admins.' }, { status: 403 });
  }
  if (target.id === auth!.userId && ((newRole && newRole !== 'super_admin' && target.roles.includes('super_admin')) || newStatus === 'disabled')) {
    return NextResponse.json({ error: 'self_lockout', message: 'You cannot demote or disable your own account.' }, { status: 422 });
  }

  const losesSuper =
    target.roles.includes('super_admin') && target.status === 'active' && ((newRole && newRole !== 'super_admin') || newStatus === 'disabled');
  if (losesSuper) {
    const other = await queryOne<{ n: string }>(
      `SELECT count(*) AS n FROM public.seo_users u JOIN public.seo_user_roles r ON r.user_id = u.id AND r.role_id = 'super_admin'
       WHERE u.status = 'active' AND u.id <> $1`,
      [target.id]
    );
    if (Number(other?.n) === 0) {
      return NextResponse.json({ error: 'last_super_admin', message: 'At least one active Super Admin is required.' }, { status: 422 });
    }
  }

  if (newRole) {
    await query(`DELETE FROM public.seo_user_roles WHERE user_id = $1`, [target.id]);
    await query(`INSERT INTO public.seo_user_roles (user_id, role_id) VALUES ($1, $2)`, [target.id, newRole]);
  }
  if (newStatus) await query(`UPDATE public.seo_users SET status = $2, updated_at = now() WHERE id = $1`, [target.id, newStatus]);

  await logAudit({
    actorId: auth!.userId,
    action: 'user.update',
    entityType: 'user',
    entityId: target.id,
    beforeState: { roles: target.roles, status: target.status },
    afterState: { roles: newRole ? [newRole] : target.roles, status: newStatus || target.status },
  });
  return NextResponse.json({ success: true });
}
