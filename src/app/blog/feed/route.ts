import { NextResponse } from 'next/server';
import { query } from '@/lib/seo-system/db';
import { SITE_URL } from '@/lib/seo-system/technical-seo';
import { escapeHtml } from '@/lib/seo-system/sanitizer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = await query<any>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at, p.body_html,
            s.meta_description_effective,
            a.display_name as author_name
     FROM public.seo_posts p
     JOIN public.seo_post_seo s ON s.post_id = p.id
     LEFT JOIN public.seo_post_authors pa ON pa.post_id = p.id AND pa.position = 1
     LEFT JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE p.status = 'published' AND s.robots_index = true
     ORDER BY p.published_at DESC
     LIMIT 50`
  );

  const items = posts.map(p => {
    const link = `${SITE_URL}/blog/${p.slug}`;
    const pubDate = new Date(p.published_at).toUTCString();
    const desc = escapeHtml(p.meta_description_effective || p.excerpt || '');
    return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
      ${p.author_name ? `<author>${escapeHtml(p.author_name)}</author>` : ''}
    </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Migration Factor Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Australian visa requirements, migration pathways, employer sponsorship and policy updates.</description>
    <language>en-AU</language>
    <atom:link href="${SITE_URL}/blog/feed" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
