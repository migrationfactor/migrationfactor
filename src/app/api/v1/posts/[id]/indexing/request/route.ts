import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import { isIndexNowEnabled, submitToIndexNow } from '@/lib/seo-system/indexing-service';
import { getConnection, postPublicUrl, submitSitemap } from '@/lib/seo-system/gsc-service';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

interface Step {
  step: string;
  status: 'done' | 'skipped' | 'failed';
  message: string;
}

/**
 * FR-IDX-004 "Request indexing": verifies indexability, submits the sitemap, notifies IndexNow
 * (non-Google engines, only if enabled) and returns a deep link for the manual Search Console
 * request. There is no public API for Google's "Request indexing" button, so that step is manual.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'indexing.submit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;

  const post = await queryOne<any>(
    `SELECT p.slug, p.status, s.robots_index, s.canonical_url
     FROM public.seo_posts p LEFT JOIN public.seo_post_seo s ON s.post_id = p.id WHERE p.id = $1`,
    [id]
  );
  if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const url = postPublicUrl(post.slug);
  const body = await req.json().catch(() => ({}));

  // The admin confirms they pressed "Request indexing" in Search Console themselves.
  if (body.manualRequested) {
    await query(
      `INSERT INTO public.seo_indexing_submissions (post_id, url, channel, action, triggered_by, user_id, response_excerpt, status, completed_at)
       VALUES ($1, $2, 'gsc_manual', 'submit', 'user', $3, 'Manual request recorded (not a confirmation of indexing)', 'submitted', now())`,
      [id, url, auth!.userId]
    );
    return NextResponse.json({ success: true, message: 'Manual request recorded. Google index status stays unchanged until an inspection confirms it.' });
  }

  const reasons: string[] = [];
  if (post.status !== 'published') reasons.push('The post is not published.');
  if (post.robots_index === false) reasons.push('The post is set to noindex.');
  if (post.canonical_url && post.canonical_url.replace(/\/$/, '') !== url) reasons.push('The canonical URL points to a different page.');
  if (reasons.length) return NextResponse.json({ error: 'not_indexable', message: reasons.join(' '), reasons }, { status: 422 });

  const recent = await queryOne(
    `SELECT 1 FROM public.seo_indexing_submissions WHERE post_id = $1 AND triggered_by = 'user' AND action = 'submit' AND channel <> 'gsc_manual'
       AND requested_at > now() - interval '1 hour'`,
    [id]
  );
  if (recent) return NextResponse.json({ error: 'rate_limited', message: 'Indexing was already requested for this URL in the last hour.' }, { status: 429 });

  const steps: Step[] = [{ step: 'Indexability check', status: 'done', message: 'URL is published, indexable and self-canonical.' }];

  const conn = await getConnection();
  if (conn.connected && conn.canSubmitSitemaps && conn.property) {
    try {
      const r = await submitSitemap(auth!.userId);
      steps.push({ step: 'Search Console sitemap', status: 'done', message: r.message });
    } catch (e: any) {
      steps.push({ step: 'Search Console sitemap', status: 'failed', message: e.message });
    }
  } else {
    steps.push({ step: 'Search Console sitemap', status: 'skipped', message: 'Connect Search Console with full access to submit sitemaps.' });
  }

  if (await isIndexNowEnabled()) {
    const r = await submitToIndexNow([url], id, auth!.userId);
    steps.push({ step: 'IndexNow (Bing and others, not Google)', status: r.success ? 'done' : 'failed', message: r.responseExcerpt });
  } else {
    steps.push({ step: 'IndexNow', status: 'skipped', message: 'IndexNow is turned off.' });
  }

  const inspectLink = conn.property
    ? `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(conn.property)}&id=${encodeURIComponent(url)}`
    : 'https://search.google.com/search-console';
  steps.push({ step: 'Request in Google Search Console', status: 'skipped', message: 'Open the link below and press "Request indexing" (Google offers no API for this).' });

  return NextResponse.json({ success: true, url, steps, inspectLink, siteUrl: SITE_URL });
}
