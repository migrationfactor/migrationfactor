import { query, queryOne } from './db';
import { SITE_URL } from './technical-seo';

/**
 * Link graph (FR-LNK-001..005) and link checker (FR-TEC-013).
 * Internal links are resolved to posts by slug or by the original WordPress path, so they survive
 * the migrated root-level URLs as well as /blog/{slug}.
 */

const SITE_HOST = new URL(SITE_URL).host.replace(/^www\./, '');

interface ParsedLink {
  href: string;
  anchor: string;
  rel: string | null;
  position: 'body' | 'faq';
}


export function extractLinks(html: string): ParsedLink[] {
  const withoutToc = html.replace(/<nav[^>]*class="table-of-contents"[\s\S]*?<\/nav>/gi, '');
  const out: ParsedLink[] = [];
  const faqRanges: Array<[number, number]> = [];
  const faqRe = /<section[^>]*class="content-faqs"[\s\S]*?<\/section>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = faqRe.exec(withoutToc))) faqRanges.push([fm.index, fm.index + fm[0].length]);

  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutToc))) {
    const attrs = m[1];
    const href = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(attrs);
    const raw = (href?.[1] ?? href?.[2] ?? '').trim();
    if (!raw || raw.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(raw)) continue;
    const rel = /rel\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? null;
    const anchor = m[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const inFaq = faqRanges.some(([a, b]) => m!.index >= a && m!.index < b);
    out.push({ href: raw.replace(/&amp;/g, '&'), anchor, rel, position: inFaq ? 'faq' : 'body' });
  }
  return out;
}

/** Returns the site path ("/blog/x", lowercase, no trailing slash) for internal URLs, or null for external ones. */
export function internalPath(href: string): string | null {
  try {
    const u = new URL(href, SITE_URL);
    if (u.host.replace(/^www\./, '') !== SITE_HOST) return null;
    const path = u.pathname.toLowerCase().replace(/\/+$/, '');
    return path || '/';
  } catch {
    return null;
  }
}

async function resolveTarget(path: string): Promise<{ id: string; status: string } | null> {
  const blog = /^\/blog\/([^/]+)$/.exec(path);
  const slug = blog ? blog[1] : /^\/([^/]+)$/.exec(path)?.[1];
  if (!slug) return null;
  return queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM public.seo_posts WHERE slug = $1 OR legacy_path = $2 LIMIT 1`,
    [slug, `${path}/`]
  );
}

/** Rebuilds the outgoing links of one post from its rendered HTML. */
export async function reindexPostLinks(postId: string): Promise<number> {
  const post = await queryOne<{ body_html: string | null }>(`SELECT body_html FROM public.seo_posts WHERE id = $1`, [postId]);
  await query(`DELETE FROM public.seo_links WHERE source_post_id = $1`, [postId]);
  if (!post?.body_html) return 0;

  const links = extractLinks(post.body_html);
  const cache = new Map<string, { id: string; status: string } | null>();
  let n = 0;
  for (const l of links) {
    const path = internalPath(l.href);
    let target: { id: string; status: string } | null = null;
    if (path !== null) {
      if (!cache.has(path)) cache.set(path, await resolveTarget(path));
      target = cache.get(path) ?? null;
    }
    const normalized = path !== null ? path : l.href.toLowerCase().replace(/#.*$/, '');
    await query(
      `INSERT INTO public.seo_links (source_post_id, target_url, target_url_normalized, target_post_id, is_internal, anchor_text, rel, position, last_status, last_checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        postId, l.href.slice(0, 2048), normalized.slice(0, 2048), target?.id ?? null, path !== null,
        l.anchor.slice(0, 255), l.rel?.slice(0, 50) ?? null, l.position,
        path !== null && target ? (target.status === 'published' ? 200 : 404) : null,
        path !== null && target ? new Date() : null,
      ]
    );
    n++;
  }
  return n;
}

export async function rebuildAllLinks(): Promise<{ posts: number; links: number }> {
  const posts = await query<{ id: string }>(`SELECT id FROM public.seo_posts WHERE status <> 'trashed'`);
  let links = 0;
  for (const p of posts) links += await reindexPostLinks(p.id);
  return { posts: posts.length, links };
}

/** Incoming and outgoing links for the editor "Links" tab (FR-LNK-004). */
export async function getPostLinks(postId: string) {
  const incoming = await query(
    `SELECT l.id, l.source_post_id, sp.title AS source_title, l.anchor_text, l.target_url
     FROM public.seo_links l JOIN public.seo_posts sp ON sp.id = l.source_post_id
     WHERE l.target_post_id = $1 AND l.source_post_id <> $1 AND sp.status = 'published' ORDER BY sp.title`,
    [postId]
  );
  const outgoing = await query(
    `SELECT l.id, l.target_url, l.anchor_text, l.rel, l.is_internal, l.last_status, l.redirect_target, l.last_checked_at, tp.title AS target_title
     FROM public.seo_links l LEFT JOIN public.seo_posts tp ON tp.id = l.target_post_id
     WHERE l.source_post_id = $1 ORDER BY l.is_internal DESC, l.id`,
    [postId]
  );
  return { incoming, outgoing };
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'how', 'what', 'is', 'are', 'your', 'you', 'guide', 'complete']);
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2 && !STOP.has(t));

/** Internal link suggestions (FR-LNK-002): ranked suggestions only; nothing is ever inserted automatically. */
export async function suggestLinks(postId: string) {
  const current = await queryOne<any>(
    `SELECT p.id, p.title, p.body_html, p.primary_category_id, s.focus_keyword
     FROM public.seo_posts p LEFT JOIN public.seo_post_seo s ON s.post_id = p.id WHERE p.id = $1`,
    [postId]
  );
  if (!current) return [];
  const already = new Set((await query<{ target_post_id: string }>(`SELECT target_post_id FROM public.seo_links WHERE source_post_id = $1 AND target_post_id IS NOT NULL`, [postId])).map((r) => r.target_post_id));
  const myTags = new Set((await query<{ tag_id: string }>(`SELECT tag_id FROM public.seo_post_tags WHERE post_id = $1`, [postId])).map((r) => r.tag_id));
  const candidates = await query<any>(
    `SELECT p.id, p.title, p.slug, p.legacy_path, p.primary_category_id, s.focus_keyword,
            (SELECT count(*) FROM public.seo_links l WHERE l.target_post_id = p.id AND l.source_post_id <> p.id)::int AS incoming,
            COALESCE((SELECT array_agg(tag_id::text) FROM public.seo_post_tags t WHERE t.post_id = p.id), '{}') AS tags
     FROM public.seo_posts p LEFT JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published' AND p.id <> $1 AND COALESCE(s.robots_index, true)`,
    [postId]
  );
  const myTokens = new Set(tokens(`${current.title} ${current.focus_keyword || ''}`));
  const text = String(current.body_html || '').replace(/<[^>]*>/g, ' ').toLowerCase();

  return candidates
    .filter((c) => !already.has(c.id))
    .map((c) => {
      const theirs = new Set(tokens(`${c.title} ${c.focus_keyword || ''}`));
      const inter = [...theirs].filter((t) => myTokens.has(t)).length;
      const union = new Set([...theirs, ...myTokens]).size || 1;
      const similarity = inter / union;
      const sharedTags = (c.tags as string[]).filter((t) => myTags.has(t)).length;
      const sameCategory = current.primary_category_id && c.primary_category_id === current.primary_category_id;
      const score = similarity * 5 + (sameCategory ? 2 : 0) + sharedTags + (c.incoming === 0 ? 1 : 0);
      const anchors = [c.focus_keyword, c.title]
        .filter((a: string | null): a is string => Boolean(a) && text.includes(String(a).toLowerCase()))
        .slice(0, 3);
      return {
        id: c.id,
        title: c.title,
        url: c.legacy_path ? c.legacy_path : `/blog/${c.slug}`,
        score: Math.round(score * 100) / 100,
        similarity: Math.round(similarity * 100) / 100,
        orphan: c.incoming === 0,
        anchors,
      };
    })
    .filter((c) => c.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/* ------------------------------ external link checker ------------------------------ */

function isPrivateHost(host: string): boolean {
  return (
    host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host === '::1' ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host)
  );
}

export async function checkUrl(url: string): Promise<{ status: number; redirect: string | null }> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) return { status: 0, redirect: null };
  const headers = { 'User-Agent': 'SeoAdminLinkChecker/1.0 (+' + SITE_URL + ')' };
  for (const method of ['HEAD', 'GET'] as const) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { method, redirect: 'manual', headers, signal: AbortSignal.timeout(10_000) });
        if (method === 'HEAD' && [403, 405, 501].includes(res.status)) break; // retry with GET
        return { status: res.status, redirect: res.headers.get('location') };
      } catch {
        /* retry, then fall through */
      }
    }
  }
  return { status: 0, redirect: null };
}

/** Weekly job: checks external links (and images) not checked in 7 days. Polite: one request at a time. */
export async function checkExternalLinks(limit = 60): Promise<{ checked: number; broken: number }> {
  const due = await query<{ id: number; target_url: string }>(
    `SELECT id, target_url FROM public.seo_links
     WHERE NOT is_internal AND (last_checked_at IS NULL OR last_checked_at < now() - interval '7 days')
     ORDER BY last_checked_at NULLS FIRST LIMIT $1`,
    [limit]
  );
  let broken = 0;
  const lastByHost = new Map<string, number>();
  for (const l of due) {
    let host = '';
    try {
      host = new URL(l.target_url).host;
    } catch {
      continue;
    }
    const wait = 500 - (Date.now() - (lastByHost.get(host) || 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const r = await checkUrl(l.target_url);
    lastByHost.set(host, Date.now());
    if (r.status >= 400 || r.status === 0) broken++;
    await query(`UPDATE public.seo_links SET last_status = $2, redirect_target = $3, last_checked_at = now() WHERE id = $1`, [l.id, r.status, r.redirect?.slice(0, 2048) ?? null]);
  }
  return { checked: due.length, broken };
}
