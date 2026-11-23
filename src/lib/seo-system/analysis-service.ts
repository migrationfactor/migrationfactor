import { query } from './db';
import { runContentAnalysis } from './analysis';
import { getPost } from './posts-service';
import { reindexPostLinks } from './link-service';
import { computeSheetScore, analysisColumns } from './sheet-score-service';

/**
 * Computes and stores the SEO / readability / GEO / AEO scores for one post from its saved state.
 * Posts that were created or imported without ever being saved through the editor have no score until this runs.
 */
export async function refreshAnalysis(postId: string): Promise<boolean> {
  const post = await getPost(postId);
  if (!post) return false;
  const seo = post.seo || {};
  const geo = post.geo_aeo || {};
  const result = runContentAnalysis({
    title: post.title,
    customH1: seo.custom_h1 || post.title,
    seoTitle: seo.seo_title_effective || seo.seo_title_raw || post.title,
    metaDescription: seo.meta_description_effective || seo.meta_description_raw || post.excerpt || '',
    slug: post.slug,
    bodyHtml: post.body_html || '',
    focusKeyword: seo.focus_keyword || '',
    additionalKeywords: Array.isArray(seo.additional_keywords) ? seo.additional_keywords : [],
    canonicalUrl: seo.canonical_url || '',
    robotsIndex: seo.robots_index !== false,
    robotsFollow: seo.robots_follow !== false,
    sitemapInclude: seo.sitemap_include !== false,
    hasFeaturedImage: Boolean(post.featured_media_id),
    featuredImageAlt: post.featured_alt_override || post.featured_media_alt || '',
    categoryAssigned: Boolean(post.primary_category_id),
    authorAssigned: Boolean(post.authors?.length),
    primaryQuestion: geo.primary_question || '',
    answerSummary: geo.answer_summary || '',
    references: post.references || [],
  } as any);
  const sheet = await computeSheetScore({
    postId,
    focusKeyword: seo.focus_keyword || '',
    seoTitle: seo.seo_title_effective || seo.seo_title_raw || post.title,
    metaDescription: seo.meta_description_effective || seo.meta_description_raw || post.excerpt || '',
    url: 'https://migrationfactor.com' + (post.legacy_path || '/blog/' + post.slug + '/'),
    bodyHtml: post.body_html || '',
    robotsIndex: seo.robots_index !== false,
    canonicalUrl: seo.canonical_url || '',
    articleSchema: !post.schema?.disable_auto,
  });
  const cols = analysisColumns(sheet);
  await query(
    `INSERT INTO public.seo_analysis (post_id, config_version, overall, basic, additional, readability, technical, geo, aeo, checks, analyzed_at)
     VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (post_id) DO UPDATE SET overall = EXCLUDED.overall, basic = EXCLUDED.basic, additional = EXCLUDED.additional,
       readability = EXCLUDED.readability, technical = EXCLUDED.technical, geo = EXCLUDED.geo, aeo = EXCLUDED.aeo,
       checks = EXCLUDED.checks, analyzed_at = now()`,
    [postId, cols.overall, cols.basic, cols.additional, cols.readability, cols.technical, result.geoScore, result.aeoScore, JSON.stringify({ ...result.checks, sheet })]
  );
  return true;
}

/** Scores (and indexes the links of) any of the given posts that have no stored analysis yet. */
export async function backfillMissing(postIds: string[]): Promise<number> {
  if (!postIds.length) return 0;
  const rows = await query<{ id: string; has_analysis: boolean; has_links: boolean }>(
    `SELECT p.id,
            EXISTS (SELECT 1 FROM public.seo_analysis a WHERE a.post_id = p.id AND a.overall IS NOT NULL) AS has_analysis,
            EXISTS (SELECT 1 FROM public.seo_links l WHERE l.source_post_id = p.id) AS has_links
     FROM public.seo_posts p WHERE p.id = ANY($1::uuid[])`,
    [postIds]
  );
  let done = 0;
  for (const r of rows) {
    try {
      if (!r.has_analysis) { await refreshAnalysis(r.id); done++; }
      if (!r.has_links) { await reindexPostLinks(r.id); done++; }
    } catch {
      /* one bad post must not break the list */
    }
  }
  return done;
}

/** Scores up to `limit` posts that have no stored analysis (used by the dashboard so averages are never empty). */
export async function backfillAllMissing(limit = 40): Promise<number> {
  const rows = await query<{ id: string }>(
    `SELECT p.id FROM public.seo_posts p LEFT JOIN public.seo_analysis a ON a.post_id = p.id
     WHERE p.status <> 'trashed' AND a.overall IS NULL ORDER BY p.created_at DESC LIMIT $1`,
    [limit]
  );
  return backfillMissing(rows.map((r) => r.id));
}
