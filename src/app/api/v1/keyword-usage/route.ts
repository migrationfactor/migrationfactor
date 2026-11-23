import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { queryOne } from '@/lib/seo-system/db';

/** How many OTHER posts already use this focus keyword (the "unique focus keyword" check). */
export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const q = new URL(req.url).searchParams;
  const keyword = (q.get('keyword') || '').trim().toLowerCase();
  const exclude = q.get('exclude');
  if (!keyword) return NextResponse.json({ count: 0 });
  const row = await queryOne<{ n: string }>(
    `SELECT count(*) AS n FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id
     WHERE lower(trim(s.focus_keyword)) = $1 AND p.status <> 'trashed' AND ($2::uuid IS NULL OR p.id <> $2::uuid)`,
    [keyword, exclude && /^[0-9a-f-]{36}$/i.test(exclude) ? exclude : null]
  );
  return NextResponse.json({ count: parseInt(row?.n || '0', 10) });
}
