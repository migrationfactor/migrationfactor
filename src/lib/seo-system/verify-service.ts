import { query, queryOne } from './db';
import { SITE_URL } from './technical-seo';
import { getSeoSettings } from './settings-service';
import { renderSeoHead, buildRobotsDirective } from './head-service';
import { getWpSource, applyAdminOverrides, buildWpMetadata } from './wp-source';
import { validateSchemaGraph } from './schema-service';

/**
 * Post-publish verification (Section 17.4): fetches the LIVE page as an anonymous client and compares
 * title, description, canonical, robots and JSON-LD with what is saved in the admin panel.
 */

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

export function parseHead(html: string) {
  const head = html.slice(0, html.search(/<\/head>/i) > 0 ? html.search(/<\/head>/i) : html.length);
  const meta = (attr: string, name: string) => {
    const re = new RegExp(`<meta\\s[^>]*${attr}=["']${name}["'][^>]*>`, 'i');
    const tag = re.exec(head)?.[0];
    return tag ? decode(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '') : null;
  };
  const titles = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1].trim()));
  const canonicals = [...head.matchAll(/<link\s[^>]*rel=["']canonical["'][^>]*>/gi)].map((m) => decode(/href=["']([^"']*)["']/i.exec(m[0])?.[1] ?? ''));
  const ldBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return {
    titles,
    canonicals,
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    ogTitle: meta('property', 'og:title'),
    ldBlocks,
    h1Count: (html.match(/<h1[\s>]/gi) || []).length,
  };
}

export async function expectedHead(postId: string) {
  const post = await queryOne<any>(
    `SELECT p.*, m.storage_path AS featured_media_url, m.alt AS featured_media_alt, m.width AS featured_media_width, m.height AS featured_media_height
     FROM public.seo_posts p LEFT JOIN public.seo_media m ON m.id = p.featured_media_id WHERE p.id = $1`,
    [postId]
  );
  if (!post) return null;
  const [seo, social, schemaConfig] = await Promise.all([
    queryOne<any>(`SELECT * FROM public.seo_post_seo WHERE post_id = $1`, [postId]),
    queryOne<any>(`SELECT * FROM public.seo_post_social WHERE post_id = $1`, [postId]),
    queryOne<any>(`SELECT * FROM public.seo_post_schema WHERE post_id = $1`, [postId]),
  ]);
  const settings = await getSeoSettings();
  const path = post.legacy_path || `/blog/${post.slug}`;
  const robots = buildRobotsDirective(seo);
  if (post.wp_id) {
    const src = await getWpSource(postId);
    if (src) {
      const m: any = applyAdminOverrides(buildWpMetadata(src), src, seo, social, schemaConfig, robots).metadata;
      return { path, title: m.title?.absolute as string, description: (m.description as string) || null, canonical: m.alternates?.canonical as string, robots };
    }
  }
  const r = renderSeoHead({ siteUrl: SITE_URL, siteName: settings.siteName, settings, post, seo, social, schemaConfig, geoAeo: null });
  return { path, title: r.title, description: r.metaDescription || null, canonical: r.canonical, robots: r.robots };
}

export interface VerifyResult {
  ok: boolean;
  problems: string[];
  checkedAt: string;
  url: string;
}

export async function verifyLivePage(postId: string): Promise<VerifyResult> {
  const exp = await expectedHead(postId);
  const checkedAt = new Date().toISOString();
  if (!exp) return { ok: false, problems: ['Post not found.'], checkedAt, url: '' };
  const url = `${SITE_URL}${exp.path}`;
  const problems: string[] = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
    if (res.status !== 200) problems.push(`The live URL answered HTTP ${res.status}, expected 200.`);
    const html = await res.text();
    const h = parseHead(html);
    if (h.titles.length !== 1) problems.push(`The page has ${h.titles.length} <title> elements (expected exactly 1).`);
    else if (exp.title && h.titles[0] !== exp.title) problems.push(`Live title "${h.titles[0]}" differs from the saved title "${exp.title}".`);
    if (exp.description && h.description !== exp.description) problems.push('The live meta description differs from the saved one.');
    if (!exp.description && h.description) problems.push('The live page outputs a meta description although none is saved.');
    if (h.canonicals.length !== 1) problems.push(`The page has ${h.canonicals.length} canonical tags (expected 1).`);
    else if (exp.canonical && h.canonicals[0].replace(/\/$/, '') !== exp.canonical.replace(/\/$/, '')) problems.push('The live canonical differs from the saved canonical.');
    const norm = (r: string | null) => (r || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).sort().join(',');
    if (norm(h.robots) !== norm(exp.robots)) problems.push('The live robots meta differs from the saved robots settings.');
    if (h.h1Count !== 1) problems.push(`The page has ${h.h1Count} <h1> elements (expected exactly 1).`);
    if (h.ldBlocks.length === 0) problems.push('No JSON-LD structured data found on the live page.');
    for (const block of h.ldBlocks) {
      try {
        const v = validateSchemaGraph(JSON.parse(block));
        if (v.errors.length) problems.push('Live structured data has errors: ' + v.errors[0]);
      } catch {
        problems.push('A JSON-LD block on the live page is not valid JSON.');
      }
    }
    // sitemap membership
    const sm = await fetch(`${SITE_URL}/post-sitemap1.xml`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.text()).catch(() => '');
    const noindex = /noindex/i.test(exp.robots);
    const inSitemap = sm.includes(exp.canonical?.replace(/\/$/, '') ?? '\u0000') || sm.includes(url.replace(/\/$/, ''));
    if (!noindex && sm && !inSitemap) problems.push('The URL is missing from the sitemap.');
  } catch (e: any) {
    problems.push(`Could not fetch the live page: ${e?.message || 'network error'}.`);
  }
  return { ok: problems.length === 0, problems, checkedAt, url };
}

/** Queues a verification ~90 seconds after a change (cache purge window). */
export async function queueLiveVerification(postId: string) {
  await query(
    `INSERT INTO public.seo_scheduled_jobs (event_type, aggregate_id, payload, available_at)
     VALUES ('post.verify_live', $1, '{}'::jsonb, now() + interval '90 seconds')`,
    [postId]
  );
}

export async function runDueVerifications(limit = 10): Promise<{ checked: number; failed: number }> {
  let checked = 0;
  let failed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await queryOne<{ id: number; aggregate_id: string }>(
      `UPDATE public.seo_scheduled_jobs SET status = 'processing', attempts = attempts + 1
       WHERE id = (SELECT id FROM public.seo_scheduled_jobs WHERE event_type = 'post.verify_live' AND status = 'pending' AND available_at <= now()
                   ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, aggregate_id`
    );
    if (!job) break;
    const result = await verifyLivePage(job.aggregate_id);
    checked++;
    if (!result.ok) failed++;
    // status 'done' = matches, 'failed' = mismatch (kept as the alert shown in the editor and dashboard)
    await query(`UPDATE public.seo_scheduled_jobs SET status = $2, last_error = $3, payload = $4 WHERE id = $1`, [
      job.id,
      result.ok ? 'done' : 'failed',
      result.ok ? null : result.problems.join(' | ').slice(0, 1000),
      JSON.stringify(result),
    ]);
  }
  return { checked, failed };
}

/** Latest live-page check for a post (editor Indexing tab). */
export async function latestVerification(postId: string) {
  return queryOne<{ status: string; last_error: string | null; payload: any; created_at: string }>(
    `SELECT status, last_error, payload, created_at FROM public.seo_scheduled_jobs
     WHERE event_type = 'post.verify_live' AND aggregate_id = $1 AND status IN ('done','failed') ORDER BY id DESC LIMIT 1`,
    [postId]
  );
}
