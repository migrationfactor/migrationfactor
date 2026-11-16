import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne, withTransaction } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';
import { getActiveRobotsTxt } from '@/lib/seo-system/technical-seo';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;

  const content = await getActiveRobotsTxt();
  const versions = await query<any>(
    `SELECT v.*, u.display_name as created_by_name
     FROM public.seo_robots_txt_versions v
     LEFT JOIN public.seo_users u ON u.id = v.created_by
     ORDER BY v.created_at DESC LIMIT 10`
  );

  return NextResponse.json({ content, versions });
}

export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'robots.edit');
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const { content, note } = body;

  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'invalid_content' }, { status: 422 });
  }

  // Deactivate prior versions and insert new active version
  const result = await withTransaction(async (client) => {
    await client.query(`UPDATE public.seo_robots_txt_versions SET active = false WHERE active = true`);

    const res = await client.query(
      `INSERT INTO public.seo_robots_txt_versions (content, created_by, active, note)
       VALUES ($1, $2, true, $3)
       RETURNING *`,
      [content, auth!.userId, note || 'Manual edit']
    );

    await logAudit({
      actorId: auth!.userId,
      action: 'robots.edit',
      entityType: 'robots_txt',
      entityId: res.rows[0].id,
      afterState: { content, note },
    });

    return res.rows[0];
  });

  return NextResponse.json(result);
}
