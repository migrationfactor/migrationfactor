import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query } from '@/lib/seo-system/db';
import { hasPermission } from '@/lib/seo-system/rbac';
import { logAudit } from '@/lib/seo-system/audit';
import { trashPost, restorePost, permanentDeletePost } from '@/lib/seo-system/posts-service';

const ACTIONS: Record<string, string> = {
  trash: 'post.delete',
  restore: 'post.delete',
  delete_permanent: 'post.delete_permanent',
  set_noindex: 'seo.edit_advanced',
  set_index: 'seo.edit_advanced',
  sitemap_include: 'seo.edit_advanced',
  sitemap_exclude: 'seo.edit_advanced',
};

function sign(userId: string, action: string, ids: string[]) {
  const secret = process.env.CRON_SECRET || process.env.DATABASE_URL || 'seo-bulk';
  return createHmac('sha256', secret).update(`${userId}|${action}|${[...ids].sort().join(',')}`).digest('hex');
}

/**
 * Two-step bulk actions (Section 15.2): without `token` returns the affected posts and a signed
 * confirmation token (dry run); with the token the action executes. Nothing changes silently.
 */
export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req);
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : [];
  const needed = ACTIONS[action];
  if (!needed) return NextResponse.json({ error: 'unknown_action' }, { status: 422 });
  if (!hasPermission((auth!.user.roles || []) as any, needed)) {
    return NextResponse.json({ error: 'forbidden', message: `Permission '${needed}' is required.` }, { status: 403 });
  }
  if (ids.length === 0) return NextResponse.json({ error: 'no_posts_selected' }, { status: 422 });
  if (action === 'delete_permanent' && ids.length > 100) {
    return NextResponse.json({ error: 'too_many', message: 'Permanent delete is limited to 100 posts per action.' }, { status: 422 });
  }

  const affected = await query<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM public.seo_posts WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const expected = sign(auth!.userId, action, affected.map((a) => a.id));

  if (!body.token) {
    return NextResponse.json({ dryRun: true, count: affected.length, affected, token: expected });
  }
  const a = Buffer.from(String(body.token));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'invalid_token', message: 'Selection changed. Review and confirm again.' }, { status: 409 });
  }
  if (action === 'delete_permanent' && body.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'confirm_required', message: 'Type DELETE to confirm.' }, { status: 422 });
  }

  const done: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];
  for (const post of affected) {
    try {
      if (action === 'trash') await trashPost(post.id, auth!.userId);
      else if (action === 'restore') await restorePost(post.id, auth!.userId);
      else if (action === 'delete_permanent') await permanentDeletePost(post.id, auth!.userId, 'DELETE');
      else if (action === 'set_noindex' || action === 'set_index') {
        await query(
          `UPDATE public.seo_post_seo SET robots_index = $2, sitemap_include = CASE WHEN $2 THEN sitemap_include ELSE false END WHERE post_id = $1`,
          [post.id, action === 'set_index']
        );
      } else {
        await query(`UPDATE public.seo_post_seo SET sitemap_include = $2 WHERE post_id = $1 AND (robots_index OR NOT $2)`, [post.id, action === 'sitemap_include']);
      }
      done.push(post.id);
    } catch (err: any) {
      failed.push({ id: post.id, message: err.message });
    }
  }
  await logAudit({ actorId: auth!.userId, action: `post.bulk_${action}`, entityType: 'post', afterState: { affected: done, failed } });
  return NextResponse.json({ success: failed.length === 0, done: done.length, failed });
}
