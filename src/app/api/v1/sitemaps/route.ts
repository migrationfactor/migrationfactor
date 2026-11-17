import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query } from '@/lib/seo-system/db';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  const [posts] = await query(
    `SELECT count(*)::int AS n, max(p.modified_at) AS lastmod FROM public.seo_posts p
     JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published' AND s.robots_index AND s.sitemap_include`
  );
  const [excluded] = await query(
    `SELECT count(*)::int AS n FROM public.seo_posts p JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published' AND (NOT s.robots_index OR NOT s.sitemap_include)`
  );
  return NextResponse.json({
    index: `${SITE_URL}/sitemap_index.xml`,
    files: [{ name: 'post-sitemap1.xml', urls: posts.n, lastmod: posts.lastmod }],
    excludedPublishedPosts: excluded.n,
    note: 'Sitemaps are generated live from the database on every request, so they always match published content.',
  });
}
