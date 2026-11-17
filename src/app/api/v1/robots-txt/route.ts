import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { queryOne, withTransaction } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';
import { getActiveRobotsTxt } from '@/lib/seo-system/technical-seo';
import { lineDiff, listRobotsVersions, validateRobotsTxt } from '@/lib/seo-system/robots-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  return NextResponse.json({ content: await getActiveRobotsTxt(), versions: await listRobotsVersions() });
}

/** Dry run: validation + diff against the active file, nothing is saved (FR-TEC-004 "review changes"). */
export async function POST(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'robots.edit');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  if (typeof body.content !== 'string') return NextResponse.json({ error: 'invalid_content' }, { status: 422 });
  const [validation, active] = await Promise.all([validateRobotsTxt(body.content), getActiveRobotsTxt()]);
  return NextResponse.json({ validation, diff: lineDiff(active, body.content) });
}

async function activate(content: string, userId: string, note: string, action: string) {
  return withTransaction(async (client) => {
    await client.query(`UPDATE public.seo_robots_txt_versions SET active = false WHERE active = true`);
    const res = await client.query(
      `INSERT INTO public.seo_robots_txt_versions (content, created_by, active, note) VALUES ($1, $2, true, $3) RETURNING *`,
      [content, userId, note]
    );
    await logAudit({ actorId: userId, action, entityType: 'robots_txt', entityId: res.rows[0].id, afterState: { note, bytes: content.length } });
    return res.rows[0];
  });
}

/** Saves a new version. Syntax errors always block; dangerous rules need confirm = "CONFIRM". */
export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'robots.edit');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  if (typeof body.content !== 'string') return NextResponse.json({ error: 'invalid_content' }, { status: 422 });

  const validation = await validateRobotsTxt(body.content);
  if (validation.errors.length) {
    return NextResponse.json({ error: 'invalid_robots', message: validation.errors[0], validation }, { status: 422 });
  }
  if (validation.dangers.length && body.confirm !== 'CONFIRM') {
    return NextResponse.json(
      { error: 'danger_confirmation_required', message: 'This change could hide pages from Google. Type CONFIRM to save it.', validation },
      { status: 409 }
    );
  }
  const row = await activate(body.content, auth!.userId, body.note || 'Manual edit', 'robots.edit');
  return NextResponse.json({ version: row, validation });
}

/** Rollback: re-activates an older version as a new version (history is never rewritten). */
export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'robots.edit');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  const old = await queryOne<{ content: string; created_at: string }>(`SELECT content, created_at FROM public.seo_robots_txt_versions WHERE id = $1`, [body.versionId]);
  if (!old) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const validation = await validateRobotsTxt(old.content);
  if (validation.dangers.length && body.confirm !== 'CONFIRM') {
    return NextResponse.json({ error: 'danger_confirmation_required', message: 'That version contains dangerous rules. Type CONFIRM to restore it.', validation }, { status: 409 });
  }
  const row = await activate(old.content, auth!.userId, `Rollback to version from ${new Date(old.created_at).toISOString()}`, 'robots.rollback');
  return NextResponse.json({ version: row });
}
