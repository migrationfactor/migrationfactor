import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query } from '@/lib/seo-system/db';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  const p = new URL(req.url).searchParams;
  const params: unknown[] = [];
  const where: string[] = [];
  if (p.get('channel')) {
    params.push(p.get('channel'));
    where.push(`channel = $${params.length}`);
  }
  if (p.get('status')) {
    params.push(p.get('status'));
    where.push(`status = $${params.length}`);
  }
  params.push(Math.min(Number(p.get('limit')) || 100, 500));
  const rows = await query(
    `SELECT id, post_id, url, channel, action, status, response_code, response_excerpt, attempts, requested_at
     FROM public.seo_indexing_submissions ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY requested_at DESC LIMIT $${params.length}`,
    params
  );
  return NextResponse.json(rows);
}
