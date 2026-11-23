import { query } from './db';
import { SITE_URL } from './site-config';
import { getSeoSettings } from './settings-service';
import { applyTitleTemplate } from './settings-defaults';
import { runContentAnalysis } from './analysis';
import { getPost } from './posts-service';
import { reindexPostLinks } from './link-service';
import { renderBlocksToHtml } from './sanitizer';
import { computeSheetScore, analysisColumns, SCORE_VERSION } from './sheet-score-service';

/**
 * Computes and stores the SEO / readability / GEO / AEO scores for one post from its saved state.
 * It uses exactly the same inputs as the editor (rendered body, effective title and description, public URL),
 * so the number in the Posts list is the number the editor shows for the saved post.
 */
export async function refreshAnalysis(postId: string): Promise<boolean> {
  const post = await getPost(postId);
  if (!post) return false;
  const settings = await getSeoSettings();
  const seo = post.seo || {};
  const geo = post.geo_aeo || {};
  const html = renderBlocksToHtml(post.body_json?.blocks || []).html;
  const seoTitle = seo.seo_title_raw || applyTitleTemplate(settings.titleTemplate, { title: post.title, siteName: settings.siteName, separator: settings.titleSeparator });
  const metaDescription = seo.meta_description_raw || post.excerpt || '';
  const url = SITE_URL + (post.legacy_path || '/blog/' + post.slug + '/');

  const result = runContentAnalysis({
    title: post.title,
    customH1: seo.custom_h1 || post.title,
    seoTitle,
    metaDescription,
    slug: post.slug,
    bodyHtml: html,
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
    trustedDomains: settings.trustedDomains,
  } as any);
  const sheet = await computeSheetScore({
    postId,
    focusKeyword: seo.focus_keyword || '',
    seoTitle,
    metaDescription,
    url,
    bodyHtml: html,
    robotsIndex: seo.robots_index !== false,
    canonicalUrl: seo.canonical_url || '',
    articleSchema: !post.schema?.disable_auto,
  });
  const cols = analysisColumns(sheet);
  await query(
    `INSERT INTO public.seo_analysis (post_id, config_version, overall, basic, additional, readability, technical, geo, aeo, checks, analyzed_at)
     VALUES ($1, ${SCORE_VERSION}, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (post_id) DO UPDATE SET config_version = EXCLUDED.config_version, overall = EXCLUDED.overall, basic = EXCLUDED.basic,
       additional = EXCLUDED.additional, readability = EXCLUDED.readability, technical = EXCLUDED.technical, geo = EXCLUDED.geo,
       aeo = EXCLUDED.aeo, checks = EXCLUDED.checks, analyzed_at = now()`,
    [postId, cols.overall, cols.basic, cols.additional, cols.readability, cols.technical, result.geoScore, result.aeoScore, JSON.stringify({ ...result.checks, sheet })]
  );
  return true;
}

/**
 * Re-scores and re-indexes the given posts when their stored score is missing or was made by an older scoring
 * version, or when their link graph is empty. Returns how many things were refreshed.
 */
export async function backfillMissing(postIds: string[]): Promise<number> {
  if (!postIds.length) return 0;
  const rows = await query<{ id: string; stale: boolean; has_links: boolean }>(
    `SELECT p.id,
            NOT EXISTS (SELECT 1 FROM public.seo_analysis a WHERE a.post_id = p.id AND a.overall IS NOT NULL AND a.config_version >= ${SCORE_VERSION}) AS stale,
            EXISTS (SELECT 1 FROM public.seo_links l WHERE l.source_post_id = p.id) AS has_links
     FROM public.seo_posts p WHERE p.id = ANY($1::uuid[])`,
    [postIds]
  );
  let done = 0;
  for (const r of rows) {
    try {
      if (r.stale) {
        // A stale score usually means the link graph is stale too, so refresh both.
        await reindexPostLinks(r.id);
        await refreshAnalysis(r.id);
        done++;
      } else if (!r.has_links) {
        await reindexPostLinks(r.id);
        done++;
      }
    } catch {
      /* one bad post must not break the list */
    }
  }
  return done;
}

/** Re-scores up to `limit` posts whose stored score is missing or outdated (used by the dashboard and the Posts list). */
export async function backfillAllMissing(limit = 40): Promise<number> {
  const rows = await query<{ id: string }>(
    `SELECT p.id FROM public.seo_posts p LEFT JOIN public.seo_analysis a ON a.post_id = p.id
     WHERE p.status <> 'trashed' AND (a.overall IS NULL OR a.config_version < ${SCORE_VERSION}) ORDER BY p.created_at DESC LIMIT $1`,
    [limit]
  );
  return backfillMissing(rows.map((r) => r.id));
}
