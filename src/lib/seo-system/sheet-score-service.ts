import { queryOne } from './db';
import { scoreSeo, type SeoScore } from './seo-score';

export interface SheetScoreSource {
  postId: string;
  focusKeyword: string;
  seoTitle: string;
  metaDescription: string;
  url: string;
  bodyHtml: string;
  robotsIndex: boolean;
  canonicalUrl: string;
  articleSchema: boolean;
}

/** Scores a post with the 100-mark sheet, adding the two checks that need the database (keyword reuse and broken links). */
export async function computeSheetScore(src: SheetScoreSource): Promise<SeoScore> {
  const kw = src.focusKeyword.trim().toLowerCase();
  const used = kw
    ? await queryOne<{ n: string }>(
        `SELECT count(*) AS n FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id
         WHERE lower(trim(s.focus_keyword)) = $1 AND p.status <> 'trashed' AND p.id <> $2`,
        [kw, src.postId]
      )
    : null;
  const broken = await queryOne<{ n: string }>(
    `SELECT count(*) AS n FROM public.seo_links WHERE source_post_id = $1 AND last_status >= 400`,
    [src.postId]
  );
  return scoreSeo({
    focusKeyword: src.focusKeyword,
    seoTitle: src.seoTitle,
    metaDescription: src.metaDescription,
    url: src.url,
    bodyHtml: src.bodyHtml,
    keywordUsedBefore: parseInt(used?.n || '0', 10),
    robotsIndex: src.robotsIndex,
    canonicalUrl: src.canonicalUrl,
    articleSchema: src.articleSchema,
    brokenLinks: parseInt(broken?.n || '0', 10),
  });
}

/** Percent (0-100) of a category, for the per-category columns the dashboard averages. */
export const pct = (earned: number, max: number) => (max ? Math.round((earned / max) * 100) : 0);

/** The values stored in seo_analysis for a sheet score. Readability is the Title + Content readability pair. */
export function analysisColumns(s: SeoScore) {
  const cat = (name: string) => s.categories.find((c) => c.name === name)!;
  const tr = cat('Title Readability');
  const cr = cat('Content Readability');
  return {
    overall: s.total,
    basic: pct(cat('Basic SEO').earned, cat('Basic SEO').max),
    additional: pct(cat('Additional SEO').earned, cat('Additional SEO').max),
    readability: pct(tr.earned + cr.earned, tr.max + cr.max),
    technical: pct(cat('Technical & Linking SEO').earned, cat('Technical & Linking SEO').max),
  };
}
