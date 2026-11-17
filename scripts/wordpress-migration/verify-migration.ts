import { config } from './config';
import { loadExport } from './fetch-posts';
import { parseHead, decodeEntities } from './extract-rankmath';
import { stripTags, pathOf } from './transform-post';
import { writeReport, type Row } from './migration-report';
import { wpGet } from './wordpress-client';
import { leftoverWpRefs, loadManifest, rewriteDeep, rewriteString, TARGET_ORIGIN } from './rewrite-urls';
import { query, getDbPool } from '../../src/lib/seo-system/db';
import { renderArticleBody } from '../../src/lib/seo-system/article-render';
import { getSeoSettings } from '../../src/lib/seo-system/settings-service';

/**
 * Compares every WordPress post with its Next.js counterpart (live HTML, not the database) and writes
 * migration-report.{json,csv} plus migration-report-failed.csv. Nothing is silently ignored: any difference is a FAIL.
 * The WordPress side is passed through the same documented URL rewrite (host -> production origin, uploads -> /media/blog),
 * so every other byte of content/metadata must match. The Next.js page must also contain no WordPress reference at all.
 * Run against a running Next.js app: MIGRATION_NEXT_BASE_URL=https://staging... npm run migrate:wp:verify
 */
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Key-order-insensitive serialisation (Postgres jsonb does not preserve object key order, which is not significant in JSON). */
const stable = (v: unknown): string => JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));
const check = (ok: boolean, detail = '') => (ok ? 'PASS' : `FAIL${detail ? `: ${detail}` : ''}`);

function imgs(html: string) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: /\ssrc=["']([^"']*)["']/i.exec(m[0])?.[1] ?? '',
    alt: /\salt=["']([^"']*)["']/i.exec(m[0])?.[1] ?? null,
  }));
}
const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*\shref=["']([^"']*)["']/gi)].map((m) => m[1]);
const h1sOf = (html: string) => [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
const jsonLd = (html: string) => [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => { try { return [JSON.parse(m[1])]; } catch { return [`UNPARSEABLE:${m[1].slice(0, 40)}`]; } });

/** Maps production-origin and root-relative URLs onto the app under test (staging / localhost), leaves other hosts alone. */
const onTestHost = (u: string) => (u.startsWith(TARGET_ORIGIN) ? `${config.nextBaseUrl}${u.slice(TARGET_ORIGIN.length)}` : u.startsWith('/') ? `${config.nextBaseUrl}${u}` : u);

async function status(url: string, method: 'HEAD' | 'GET' = 'HEAD'): Promise<number> {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { method, redirect: 'follow' }); if (r.status !== 405) return r.status; return (await fetch(url, { redirect: 'follow' })).status; } catch { /* retry */ }
  }
  return 0;
}

function compareMaps(label: string, wp: Record<string, string[]>, next: Record<string, string[]>) {
  const diffs: string[] = [];
  for (const [k, v] of Object.entries(wp)) if (!same([...v].sort(), [...(next[k] ?? [])].sort())) diffs.push(`${k}: expected=${JSON.stringify(v)} next=${JSON.stringify(next[k] ?? null)}`);
  return diffs.length ? `FAIL ${label}: ${diffs.join(' ; ')}` : 'PASS';
}

async function main() {
  const bundle = loadExport();
  const manifest = loadManifest();
  const html = (s: string) => rewriteString(s, manifest, 'html');
  // The blog renderer adds responsive <picture> markup (and an optional auto-TOC); expectations go through the same pure function.
  const settings = await getSeoSettings();
  const rendered = (s: string) => renderArticleBody(html(s), { autoTocMinH2: settings.autoTocMinH2 });
  const rows: Row[] = [];
  const dbPosts = await query<{ id: string; wp_id: string; slug: string; published_at: string; modified_at: string; status: string; legacy_path: string }>(
    `SELECT id, wp_id, slug, published_at, modified_at, status, legacy_path FROM public.seo_posts WHERE wp_id IS NOT NULL`);
  const dbCats = await query<{ wp_id: string; name: string }>(`SELECT p.wp_id, c.name FROM public.seo_post_categories pc JOIN public.seo_posts p ON p.id=pc.post_id JOIN public.seo_categories c ON c.id=pc.category_id WHERE p.wp_id IS NOT NULL`);
  const dbTags = await query<{ wp_id: string; name: string }>(`SELECT p.wp_id, t.name FROM public.seo_post_tags pt JOIN public.seo_posts p ON p.id=pt.post_id JOIN public.seo_tags t ON t.id=pt.tag_id WHERE p.wp_id IS NOT NULL`);
  const dupes = await query<{ n: string }>(`SELECT count(*)::text n FROM (SELECT wp_id FROM public.seo_posts WHERE wp_id IS NOT NULL GROUP BY wp_id HAVING count(*)>1) x`);
  const dupSlugs = await query<{ n: string }>(`SELECT count(*)::text n FROM (SELECT slug FROM public.seo_posts WHERE status<>'trashed' GROUP BY slug HAVING count(*)>1) x`);
  const mediaRows = await query<{ storage_path: string }>(`SELECT m.storage_path FROM public.seo_media m JOIN public.seo_posts p ON p.featured_media_id = m.id WHERE p.wp_id IS NOT NULL`);

  for (const p of bundle.posts) {
    const path = pathOf(p.link);
    const expectedUrl = `${TARGET_ORIGIN}${path}`;
    const row: Row = { wp_id: p.id, wp_url: p.link, new_url: expectedUrl, tested_at: `${config.nextBaseUrl}${path}` };
    try {
      const [wp, nx] = await Promise.all([wpGet<string>(p.link, { text: true }), fetch(`${config.nextBaseUrl}${path}`, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } })]);
      const nextHtml = await nx.text();
      const w = rewriteDeep(parseHead(wp.data), manifest); // expected values after the documented URL rewrite
      const n = parseHead(nextHtml);
      const db = dbPosts.find((d) => Number(d.wp_id) === p.id);
      const contentStart = nextHtml.indexOf('class="blog-content"');
      const nextContent = nextHtml.slice(contentStart);
      const expectedContent = rendered(p.content.rendered);

      row.url_match = check(!!db && db.legacy_path === path && new URL(p.link).pathname === path, `db legacy_path=${db?.legacy_path}`);
      row.http_status = check(nx.status === 200 && wp.status === 200, `wp=${wp.status} next=${nx.status}`);
      row.seo_title = check(w.title === n.title, `expected="${w.title}" next="${n.title}"`);
      row.meta_description = check(w.description === n.description, `expected="${w.description}" next="${n.description}"`);
      row.canonical = check(n.canonical === expectedUrl && w.canonical === expectedUrl, `expected=${expectedUrl} next=${n.canonical}`);
      const xrt = nx.headers.get('x-robots-tag') ?? '';
      row.robots = check(w.robots === n.robots && !/noindex/i.test(xrt) && !/noindex/i.test(n.robots ?? ''), `expected=${w.robots} next=${n.robots} x-robots-tag=${xrt}`);
      // WordPress's theme renders "Latest News" as its only <h1>; the post title is a lower heading there. The Next page must have
      // exactly one <h1> and it must be the post title as WordPress shows it in some heading. The literal WP H1 is reported for review.
      const wpH1s = h1sOf(wp.data).map(norm); const nxH1s = h1sOf(nextHtml).map(norm);
      const wpHeadings = [...wp.data.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].map((m) => norm(stripTags(m[1])));
      row.wp_literal_h1 = wpH1s.join(' | ');
      row.h1 = check(nxH1s.length === 1 && wpHeadings.includes(nxH1s[0]) && nxH1s[0] === norm(decodeEntities(p.title.rendered)), `next=${JSON.stringify(nxH1s)} wp h1=${JSON.stringify(wpH1s)}`);
      row.content_exact = check(nextHtml.includes(expectedContent), 'WordPress content (after URL rewrite) not found verbatim in Next.js response');
      const wImgs = imgs(expectedContent);
      const nImgs = imgs(nextContent);
      row.image_alts = check(wImgs.every((i) => nImgs.some((j) => j.src === i.src && j.alt === i.alt)), `${wImgs.filter((i) => !nImgs.some((j) => j.src === i.src && j.alt === i.alt)).length} content image(s) differ`);
      const media = bundle.media.find((m) => m.id === p.featured_media);
      const localFeatured = media ? manifest[media.source_url] : undefined;
      // The featured image may be served through the Next image optimizer (/_next/image?url=<local path>).
      const realSrc = (s: string) => (s.startsWith('/_next/image') ? decodeURIComponent(new URL(s.split('&amp;').join('&'), 'http://x').searchParams.get('url') ?? '') : s);
      const featNext = imgs(nextHtml).find((i) => realSrc(i.src) === localFeatured);
      row.featured_image = check(!!media && !!localFeatured && w.og['og:image']?.[0] === `${TARGET_ORIGIN}${localFeatured}` && !!featNext && (featNext.alt ?? '') === (w.og['og:image:alt']?.[0] ?? featNext.alt), `og=${w.og['og:image']?.[0]} next=${featNext?.src ?? 'not rendered'}`);
      const wLinks = hrefs(expectedContent); const nLinks = hrefs(nextContent);
      row.internal_links = check(wLinks.every((h) => nLinks.includes(h)), 'content links differ');
      // Every link that stays on our domain must resolve on the new site (a 404 here is lost link equity).
      const internal = [...new Set(hrefs(expectedContent).filter((h) => h.startsWith(TARGET_ORIGIN) || (h.startsWith('/') && !h.startsWith('//'))).map((h) => h.split('#')[0]).filter(Boolean))];
      const deadLinks: string[] = [];
      for (const h of internal) { const s = await status(onTestHost(h), 'GET'); if (s !== 200) deadLinks.push(`${s} ${h}`); }
      row.internal_link_targets = check(deadLinks.length === 0, deadLinks.join(' ; '));
      const wpCats = bundle.categories.filter((c) => p.categories.includes(c.id)).map((c) => decodeEntities(c.name)).sort();
      const wpTags = bundle.tags.filter((c) => p.tags.includes(c.id)).map((c) => decodeEntities(c.name)).sort();
      const dbC = dbCats.filter((c) => Number(c.wp_id) === p.id).map((c) => c.name).sort();
      const dbT = dbTags.filter((c) => Number(c.wp_id) === p.id).map((c) => c.name).sort();
      row.categories_tags = check(same(wpCats, dbC) && same(wpTags, dbT), `wp cats=${wpCats} tags=${wpTags} db cats=${dbC} tags=${dbT}`);
      row.published_date = check(!!db && new Date(db.published_at).getTime() === new Date(p.date_gmt + 'Z').getTime() && new Date(db.modified_at).getTime() === new Date(p.modified_gmt + 'Z').getTime() && same(w.article['article:published_time']?.[0] && new Date(w.article['article:published_time'][0]).getTime(), n.article['article:published_time']?.[0] && new Date(n.article['article:published_time'][0]).getTime()), 'dates differ');
      row.open_graph = compareMaps('og', w.og, n.og);
      row.twitter = compareMaps('twitter', w.twitter, n.twitter);
      const wLd = w.jsonld; const nLd = jsonLd(nextHtml);
      row.structured_data = check(stable(wLd) === stable(nLd), `expected blocks=${wLd.length} next blocks=${nLd.length}${stable(wLd) === stable(nLd) ? '' : ' (content differs)'}`);

      // Zero WordPress dependency: no wp-content / wp-json / old-host URL anywhere in the served page.
      const refs = [...new Set(leftoverWpRefs(nextHtml))];
      row.no_wordpress_refs = check(refs.length === 0, refs.slice(0, 5).join(' ; '));
      // Every image used by the page (content, srcset, featured, og/twitter, JSON-LD) must be served by the app itself.
      const imageUrls = new Set<string>([...wImgs.map((i) => i.src), ...(localFeatured ? [localFeatured] : []), ...(w.og['og:image'] ?? []), ...(w.twitter['twitter:image'] ?? [])]);
      for (const m of expectedContent.matchAll(/srcset=["']([^"']+)["']/gi)) for (const part of m[1].split(',')) imageUrls.add(part.trim().split(/\s+/)[0]);
      for (const m of JSON.stringify(wLd).matchAll(/https?:\/\/[^"\\]+\.(?:webp|png|jpe?g|gif|svg)/gi)) imageUrls.add(m[0]);
      const bad: string[] = [];
      for (const u of imageUrls) {
        if (!u) continue;
        if (/^https?:/.test(u) && !u.startsWith(TARGET_ORIGIN)) { bad.push(`external image ${u}`); continue; }
        const s = await status(onTestHost(u));
        if (s < 200 || s >= 300) bad.push(`${s} ${u}`);
      }
      row.broken_or_external_images = check(bad.length === 0, bad.join(' ; '));
    } catch (e) {
      row.error = `FAIL: ${(e as Error).message}`;
    }
    rows.push(row);
    console.log(`#${p.id} ${path} ${Object.values(row).some((v) => typeof v === 'string' && v.startsWith('FAIL')) ? 'FAIL' : 'ok'}`);
  }

  const failRow = (r: Row) => Object.values(r).some((v) => typeof v === 'string' && v.startsWith('FAIL'));
  const failedCount = rows.filter(failRow).length;
  const wpMedia = mediaRows.filter((m) => /^https?:/.test(m.storage_path) || /wp-content/.test(m.storage_path)).length;
  const summary = {
    nextBaseUrl: config.nextBaseUrl, targetOrigin: TARGET_ORIGIN, wordpressPosts: bundle.posts.length, wordpressReportedTotal: bundle.totalReported,
    importedInDatabase: dbPosts.length, publishedInDatabase: dbPosts.filter((d) => d.status === 'published').length,
    duplicateWpIds: Number(dupes[0]?.n ?? 0), duplicateSlugs: Number(dupSlugs[0]?.n ?? 0), featuredMediaStillOnWordPress: wpMedia, postsWithFailures: failedCount,
    accepted: dbPosts.length === bundle.posts.length && Number(dupes[0]?.n ?? 0) === 0 && Number(dupSlugs[0]?.n ?? 0) === 0 && wpMedia === 0 && failedCount === 0,
  };
  const { base } = writeReport('migration-report', rows, summary, failRow);
  console.log(`\n${JSON.stringify(summary, null, 2)}\nReports: ${base}.json / .csv / -failed.csv`);
  await getDbPool().end().catch(() => undefined);
  if (!summary.accepted) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
