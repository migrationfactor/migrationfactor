import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

const ALLOWED_CODES = [301, 302, 307, 308, 410, 451];

/** Normalises a path/URL to a comparable site path ("/blog/x/"), or null when external. */
function toSitePath(value: string): string | null {
  try {
    const u = new URL(value, SITE_URL);
    if (u.host !== new URL(SITE_URL).host) return null;
    return u.pathname.toLowerCase().replace(/\/*$/, '/');
  } catch {
    return null;
  }
}

/** FR-TEC-009 validation: returns an error message, or null when the rule is acceptable. */
async function validateRedirect(source: string, target: string, code: number, ignoreId?: string): Promise<string | null> {
  if (!source.startsWith('/')) return 'Source must be a path starting with "/".';
  if (!ALLOWED_CODES.includes(code)) return 'Unsupported HTTP status code.';
  if (code === 410 || code === 451) return null;
  if (/^\s*(javascript|data|vbscript):/i.test(target)) return 'Target URL scheme is not allowed.';
  if (!/^(\/|https?:\/\/)/i.test(target)) return 'Target must be a relative path or an absolute http(s) URL.';
  const src = toSitePath(source);
  const tgt = toSitePath(target);
  if (src && tgt && src === tgt) return 'A URL cannot redirect to itself.';
  if (src) {
    const live = await queryOne<any>(`SELECT title FROM public.seo_posts WHERE status = 'published' AND '/blog/' || slug = rtrim($1, '/')`, [src]);
    if (live) return `"${live.title}" is published at this URL. Unpublish it first or change its slug.`;
  }
  // Loop / chain detection: follow the target through existing redirects (max 10 hops)
  let hop = tgt;
  const seen = new Set<string>(src ? [src] : []);
  for (let i = 0; hop && i < 10; i++) {
    if (seen.has(hop)) return 'This redirect would create a loop.';
    seen.add(hop);
    const next = await queryOne<{ target_url: string }>(
      `SELECT target_url FROM public.seo_redirects WHERE active = true AND rtrim(source_path, '/') = rtrim($1, '/') AND ($2::uuid IS NULL OR id <> $2) LIMIT 1`,
      [hop, ignoreId || null]
    );
    if (!next) break;
    hop = toSitePath(next.target_url);
    if (hop && i === 0 && !seen.has(hop)) return `The target already redirects to ${next.target_url}. Point this rule at the final URL to avoid a redirect chain.`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'redirects.edit');
  if (errorResponse) return errorResponse;

  const redirects = await query<any>(
    `SELECT r.*, u.display_name as created_by_name
     FROM public.seo_redirects r
     LEFT JOIN public.seo_users u ON u.id = r.created_by
     ORDER BY r.created_at DESC`
  );
  return NextResponse.json(redirects);
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'redirects.edit');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { sourcePath, targetUrl, httpCode = 301, notes } = body;

    if (!sourcePath || !targetUrl) {
      return NextResponse.json({ error: 'source_and_target_required' }, { status: 422 });
    }

    const cleanSource = sourcePath.toLowerCase().trim();
    const cleanTarget = targetUrl.trim();

    const problem = await validateRedirect(cleanSource, cleanTarget, Number(httpCode));
    if (problem) return NextResponse.json({ error: 'invalid_redirect', message: problem }, { status: 422 });

    const res = await queryOne<any>(
      `INSERT INTO public.seo_redirects (
        source_path, target_url, http_code, created_by, notes
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (source_path) DO UPDATE SET
        target_url = EXCLUDED.target_url,
        http_code = EXCLUDED.http_code,
        notes = EXCLUDED.notes
      RETURNING *`,
      [cleanSource, cleanTarget, httpCode, auth!.userId, notes || null]
    );

    await logAudit({
      actorId: auth!.userId,
      action: 'redirect.create',
      entityType: 'redirect',
      entityId: res.id,
      afterState: res,
    });

    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'create_failed', message: err.message }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'redirects.edit');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  const current = await queryOne<any>(`SELECT * FROM public.seo_redirects WHERE id = $1`, [id]);
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await query(`DELETE FROM public.seo_redirects WHERE id = $1`, [id]);

  await logAudit({
    actorId: auth!.userId,
    action: 'redirect.delete',
    entityType: 'redirect',
    entityId: id,
    beforeState: current,
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'redirects.edit');
  if (errorResponse) return errorResponse;

  const body = await req.json().catch(() => ({}));
  const current = body.id ? await queryOne<any>(`SELECT * FROM public.seo_redirects WHERE id = $1`, [body.id]) : null;
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const target = body.targetUrl !== undefined ? String(body.targetUrl).trim() : current.target_url;
  const code = body.httpCode !== undefined ? Number(body.httpCode) : current.http_code;
  const active = body.active !== undefined ? Boolean(body.active) : current.active;
  if (active) {
    const problem = await validateRedirect(current.source_path, target, code, current.id);
    if (problem) return NextResponse.json({ error: 'invalid_redirect', message: problem }, { status: 422 });
  }
  const res = await queryOne<any>(
    `UPDATE public.seo_redirects SET target_url = $2, http_code = $3, active = $4, notes = COALESCE($5, notes) WHERE id = $1 RETURNING *`,
    [current.id, target, code, active, body.notes ?? null]
  );
  await logAudit({ actorId: auth!.userId, action: 'redirect.update', entityType: 'redirect', entityId: current.id, beforeState: current, afterState: res });
  return NextResponse.json(res);
}
