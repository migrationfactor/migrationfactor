import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';

/**
 * Soft edit lock (FR-BLG-003): one editor holds a post at a time, refreshed by a heartbeat.
 * A lock with no heartbeat for 2 minutes is free. Admins may take over with { takeover: true }.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.edit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const roles: string[] = (auth!.user.roles || []) as string[];
  const mayTakeOver = roles.some((r) => r === 'super_admin' || r === 'admin' || r === 'seo_manager');

  const held = await queryOne<{ user_id: string; name: string }>(
    `SELECT l.user_id, u.name FROM public.seo_edit_locks l JOIN public.seo_users u ON u.id = l.user_id
     WHERE l.post_id = $1 AND l.heartbeat_at > now() - interval '2 minutes'`,
    [id]
  );
  if (held && held.user_id !== auth!.userId && !(body.takeover && mayTakeOver)) {
    return NextResponse.json({ locked: true, lockedBy: held.name, canTakeOver: mayTakeOver }, { status: 200 });
  }
  await query(
    `INSERT INTO public.seo_edit_locks (post_id, user_id) VALUES ($1, $2)
     ON CONFLICT (post_id) DO UPDATE SET user_id = $2, heartbeat_at = now(),
       acquired_at = CASE WHEN public.seo_edit_locks.user_id = $2 THEN public.seo_edit_locks.acquired_at ELSE now() END`,
    [id, auth!.userId]
  );
  return NextResponse.json({ locked: false, mine: true });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.edit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  await query(`DELETE FROM public.seo_edit_locks WHERE post_id = $1 AND user_id = $2`, [id, auth!.userId]);
  return NextResponse.json({ released: true });
}
