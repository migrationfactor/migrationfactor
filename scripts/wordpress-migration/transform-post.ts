import crypto from 'node:crypto';
import { decodeEntities, type RankMathData } from './extract-rankmath';
import type { WpMedia } from './fetch-media';
import type { WpTerm, WpUser } from './fetch-taxonomies';
import { leftoverWpRefs, loadManifest, rewriteDeep, rewriteString, type MediaManifest } from './rewrite-urls';

export interface WpPost {
  id: number; date: string; date_gmt: string; modified: string; modified_gmt: string; slug: string; status: string; link: string; guid?: { rendered: string };
  title: { rendered: string; raw?: string }; content: { rendered: string; raw?: string }; excerpt: { rendered: string; raw?: string };
  author: number; featured_media: number; categories: number[]; tags: number[]; meta?: Record<string, unknown>;
}

export interface ExportBundle {
  exportedAt: string; wpBaseUrl: string; authenticated: boolean; totalReported: number;
  posts: WpPost[]; media: WpMedia[]; categories: WpTerm[]; tags: WpTerm[]; users: WpUser[]; rankmath: Record<string, RankMathData>;
}

export interface TransformedPost {
  wpId: number; slug: string; legacyPath: string; title: string; bodyHtml: string; excerpt: string | null; excerptFull: string;
  publishedAt: string; modifiedAt: string; wordCount: number; readingTimeMin: number; contentSha256: string;
  featured: { wpId: number; url: string; alt: string; caption: string | null; width: number; height: number; mime: string; filename: string; size: number } | null;
  categoryWpIds: number[]; tagWpIds: number[]; primaryCategoryWpId: number | null; articleSection: string | null; authorWpId: number;
  seo: {
    titleRaw: string | null; descriptionRaw: string | null; canonical: string | null; focusKeyword: string | null; additionalKeywords: string[];
    robotsIndex: boolean; robotsFollow: boolean; robotsAdvanced: Record<string, unknown>;
  };
  social: { ogTitle: string | null; ogDescription: string | null; twitterCard: string; twitterTitle: string | null; twitterDescription: string | null };
  jsonld: unknown[]; rankmath: RankMathData | null; rankmathOriginal: RankMathData | null; warnings: string[];
}

export const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const iso = (gmt: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(gmt) ? gmt : `${gmt}Z`).toISOString();

export function parseRobots(robots: string | null) {
  const tokens = (robots ?? 'index, follow').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const adv: Record<string, unknown> = { nosnippet: false, max_snippet: -1, max_image_preview: 'large', max_video_preview: -1, noimageindex: false, notranslate: false, unavailable_after: null, indexifembedded: false, noarchive: false };
  for (const t of tokens) {
    const [k, v] = t.split(':');
    if (k === 'max-snippet') adv.max_snippet = Number(v);
    else if (k === 'max-image-preview') adv.max_image_preview = v;
    else if (k === 'max-video-preview') adv.max_video_preview = Number(v);
    else if (['nosnippet', 'noimageindex', 'notranslate', 'noarchive', 'indexifembedded'].includes(k)) adv[k] = true;
  }
  return { index: !tokens.includes('noindex'), follow: !tokens.includes('nofollow'), advanced: adv };
}

/** Path with a trailing slash, exactly as WordPress serves it. */
export const pathOf = (link: string) => { const u = new URL(link); return u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`; };

export function transformPost(post: WpPost, bundle: Pick<ExportBundle, 'media'>, rankmathOriginal: RankMathData | null, manifest: MediaManifest = loadManifest()): TransformedPost {
  const warnings: string[] = [];
  // Only URL edits are applied (WordPress media -> /media/blog, old host -> production origin); see rewrite-urls.ts.
  const rankmath = rankmathOriginal ? rewriteDeep(rankmathOriginal, manifest) : null;
  const bodyHtml = rewriteString(post.content.rendered, manifest, 'html');
  const leftovers = [...new Set([...leftoverWpRefs(bodyHtml), ...leftoverWpRefs(JSON.stringify(rankmath ?? {}))])];
  if (leftovers.length) warnings.push(`WordPress references remain after rewrite: ${leftovers.slice(0, 5).join(' ; ')}`);
  const title = decodeEntities(post.title.rendered).trim();
  const excerptFull = stripTags(post.excerpt.rendered);
  const excerpt = excerptFull.length > 320 ? excerptFull.slice(0, 320) : excerptFull || null;
  if (excerptFull.length > 320) warnings.push(`excerpt ${excerptFull.length} chars truncated to 320 in seo_posts.excerpt (full text kept in seo_wp_post_source.excerpt_rendered)`);
  if (title.length > 200) warnings.push(`title longer than 200 chars (${title.length})`);

  const m = bundle.media.find((x) => x.id === post.featured_media);
  if (post.featured_media && !m) warnings.push(`featured media ${post.featured_media} not found`);
  const featured = m ? {
    wpId: m.id, url: manifest[m.source_url] ?? m.source_url, alt: m.alt_text ?? '', caption: m.caption?.rendered ? stripTags(m.caption.rendered) || null : null,
    width: m.media_details?.width ?? 0, height: m.media_details?.height ?? 0, mime: m.mime_type,
    filename: decodeURIComponent(new URL(m.source_url).pathname.split('/').pop() || 'image'), size: m.media_details?.filesize ?? 0,
  } : null;
  if (featured && featured.alt.length > 150) warnings.push(`featured image alt is ${featured.alt.length} chars; seo_media.alt allows 150`);

  const rmPrimary = typeof post.meta?.rank_math_primary_category === 'string' ? Number(post.meta.rank_math_primary_category) : NaN;
  const primary = post.categories.includes(rmPrimary) ? rmPrimary : null;
  const articleSection = rankmath?.article?.['article:section']?.[0] ?? null;

  const robots = parseRobots(rankmath?.robots ?? null);
  if (!rankmath) warnings.push('no Rank Math data captured');
  for (const missing of rankmath?.missing ?? []) warnings.push(`rank math missing: ${missing}`);
  if (rankmath?.focus_keyword_source === 'jsonld-keywords') warnings.push('focus keyword derived from Rank Math JSON-LD keywords (REST meta unavailable)');
  if (rankmath?.canonical && pathOf(rankmath.canonical) !== pathOf(post.link)) warnings.push(`canonical differs from permalink (${rankmath.canonical})`);
  const words = stripTags(bodyHtml).split(/\s+/).filter(Boolean).length;

  return {
    wpId: post.id, slug: post.slug, legacyPath: pathOf(post.link), title, bodyHtml, excerpt, excerptFull,
    publishedAt: iso(post.date_gmt), modifiedAt: iso(post.modified_gmt), wordCount: words, readingTimeMin: Math.max(1, Math.round(words / 200)),
    contentSha256: sha256(bodyHtml), featured, categoryWpIds: post.categories, tagWpIds: post.tags, primaryCategoryWpId: primary, articleSection, authorWpId: post.author,
    seo: {
      titleRaw: rankmath?.title ?? null, descriptionRaw: rankmath?.description ?? null, canonical: rankmath?.canonical ?? null,
      focusKeyword: rankmath?.focus_keyword ?? null, additionalKeywords: rankmath?.additional_keywords ?? [], robotsIndex: robots.index, robotsFollow: robots.follow, robotsAdvanced: robots.advanced,
    },
    social: {
      ogTitle: rankmath?.og['og:title']?.[0] ?? null, ogDescription: rankmath?.og['og:description']?.[0] ?? null,
      twitterCard: rankmath?.twitter['twitter:card']?.[0] ?? 'summary_large_image',
      twitterTitle: rankmath?.twitter['twitter:title']?.[0] ?? null, twitterDescription: rankmath?.twitter['twitter:description']?.[0] ?? null,
    },
    jsonld: rankmath?.jsonld ?? [], rankmath, rankmathOriginal, warnings,
  };
}
