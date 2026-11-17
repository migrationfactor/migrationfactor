import { wpGet } from './wordpress-client';

/**
 * Rank Math does not expose its post meta over the default REST API. The authoritative public output is the
 * <head> WordPress actually serves, so that is parsed (read-only GET). A focus keyword is never printed in
 * the head; it is only available when `rank_math_focus_keyword` is registered for REST (see rankmath-rest.php)
 * and requested with credentials. Missing fields are reported, never invented.
 */
export interface RankMathData {
  source: 'live-head';
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  og: Record<string, string[]>;
  twitter: Record<string, string[]>;
  article: Record<string, string[]>;
  jsonld: unknown[];
  focus_keyword: string | null;
  /** 'rest-meta' = exact Rank Math field; 'jsonld-keywords' = first entry of the BlogPosting keywords Rank Math publishes. */
  focus_keyword_source: 'rest-meta' | 'jsonld-keywords' | null;
  additional_keywords: string[];
  missing: string[];
}

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return named[e.toLowerCase()] ?? m;
  });
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? '');
  return out;
}

export function parseHead(html: string): Omit<RankMathData, 'focus_keyword' | 'focus_keyword_source' | 'additional_keywords' | 'missing' | 'source'> {
  const end = html.search(/<\/head>/i);
  const head = end > -1 ? html.slice(0, end) : html;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  const og: Record<string, string[]> = {};
  const twitter: Record<string, string[]> = {};
  const article: Record<string, string[]> = {};
  let description: string | null = null;
  let robots: string | null = null;
  let canonical: string | null = null;
  const push = (bag: Record<string, string[]>, k: string, v: string) => (bag[k] ||= []).push(v);

  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = a.property || a.name;
    if (!key || a.content === undefined) continue;
    if (key === 'description') description = a.content;
    else if (key === 'robots') robots = a.content;
    else if (key.startsWith('og:')) push(og, key, a.content);
    else if (key.startsWith('twitter:')) push(twitter, key, a.content);
    else if (key.startsWith('article:')) push(article, key, a.content);
  }
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (a.rel === 'canonical') canonical = a.href ?? null;
  }
  const jsonld: unknown[] = [];
  for (const m of head.matchAll(/<script\b([^>]*)type=["']application\/ld\+json["']([^>]*)>([\s\S]*?)<\/script>/gi)) {
    try { jsonld.push(JSON.parse(m[3])); } catch { /* reported via missing/parse check in verify */ }
  }
  return { title: title ? decodeEntities(title.trim()) : null, description, canonical, robots, og, twitter, article, jsonld };
}

/** Rank Math writes `keywords` = focus keyword followed by secondary keywords, comma-separated, into the BlogPosting node. */
function keywordsFromJsonLd(jsonld: unknown[]): string[] {
  const nodes = jsonld.flatMap((b) => ((b as { '@graph'?: unknown[] })['@graph'] ?? [b]) as Array<{ '@type'?: string | string[]; keywords?: unknown }>);
  const post = nodes.find((n) => [n['@type']].flat().some((t) => t === 'BlogPosting' || t === 'Article' || t === 'NewsArticle'));
  return typeof post?.keywords === 'string' ? post.keywords.split(',').map((k) => k.trim()).filter(Boolean) : [];
}

export async function extractRankMath(permalink: string, restMeta?: Record<string, unknown>): Promise<RankMathData> {
  const { data: html } = await wpGet<string>(permalink, { text: true });
  const parsed = parseHead(html);
  const restFocus = typeof restMeta?.rank_math_focus_keyword === 'string' && restMeta.rank_math_focus_keyword ? restMeta.rank_math_focus_keyword : null;
  const derived = keywordsFromJsonLd(parsed.jsonld);
  const focus = restFocus ?? derived[0] ?? null;
  const additional = (restFocus ? restFocus.split(',').slice(1).map((k) => k.trim()) : derived.slice(1)).filter(Boolean);
  const missing: string[] = [];
  if (!parsed.title) missing.push('title');
  if (!parsed.description) missing.push('description');
  if (!parsed.canonical) missing.push('canonical');
  if (!parsed.robots) missing.push('robots');
  if (!parsed.jsonld.length) missing.push('structured data');
  if (!parsed.og['og:title']) missing.push('og:title');
  if (!parsed.twitter['twitter:card']) missing.push('twitter:card');
  if (!focus) missing.push('focus_keyword (not exposed by REST; install rankmath-rest.php and set WP_USERNAME/WP_APP_PASSWORD)');
  return { source: 'live-head', ...parsed, focus_keyword: restFocus ? restFocus.split(',')[0].trim() : focus, focus_keyword_source: restFocus ? 'rest-meta' : focus ? 'jsonld-keywords' : null, additional_keywords: additional, missing };
}
