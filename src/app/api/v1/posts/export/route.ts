import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listPosts } from '@/lib/seo-system/posts-service';

const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
  return `"${s.replace(/"/g, '""')}"`;
};

/** CSV export of the posts list with the same filters as the screen (FR-DSH-004). */
export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const q = new URL(req.url).searchParams;
  const { posts } = await listPosts({
    status: q.get('status') || 'all',
    categoryId: q.get('category_id') || undefined,
    authorId: q.get('author_id') || undefined,
    scoreBand: (q.get('score_band') as any) || undefined,
    missing: (q.get('missing') as any) || undefined,
    orphans: q.get('orphans') === 'true',
    robotsIndex: q.get('robots_index') ? q.get('robots_index') === 'true' : undefined,
    search: q.get('q') || undefined,
    limit: 5000,
    offset: 0,
  });
  const head = ['Title', 'Path', 'Status', 'Focus keyword', 'SEO score', 'Readability', 'GEO', 'AEO', 'Words', 'Indexable', 'Published'];
  const rows = posts.map((p: any) => [p.title, p.legacy_path || `/blog/${p.slug}`, p.status, p.focus_keyword, p.seo_score, p.seo_readability, p.geo_score, p.aeo_score, p.word_count, p.robots_index, p.published_at ? new Date(p.published_at).toISOString() : ''].map(cell).join(','));
  return new NextResponse([head.map(cell).join(','), ...rows].join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="posts.csv"', 'Cache-Control': 'no-store' },
  });
}
