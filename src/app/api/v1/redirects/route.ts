import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';

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

    if (cleanSource === cleanTarget) {
      return NextResponse.json({ error: 'self_redirect', message: 'A URL cannot redirect to itself.' }, { status: 422 });
    }

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
