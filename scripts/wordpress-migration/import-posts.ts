import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';
import { arg, config } from './config';
import { buildBundle, loadExport } from './fetch-posts';
import { transformPost, type ExportBundle, type TransformedPost } from './transform-post';
import { writeReport, type Row } from './migration-report';
import { query, queryOne, withTransaction, getDbPool } from '../../src/lib/seo-system/db';

const dryRun = arg('dry-run') === 'true';
const force = arg('force') === 'true';
const resume = arg('resume') === 'true';
const runId = crypto.randomUUID();
const checkpointPath = path.join(config.dataDir, config.checkpointFile);
const logPath = path.join(config.dataDir, `import-${runId}.log.ndjson`);

type Ctx = { client: PoolClient; bundle: ExportBundle };
let dbLogOk = true;

async function log(level: 'info' | 'warn' | 'error', action: string, wpId: number | null, message: string, detail?: unknown) {
  fs.appendFileSync(logPath, JSON.stringify({ t: new Date().toISOString(), level, action, wpId, message, detail }) + '\n');
  if (dryRun || !dbLogOk) return;
  try {
    await query(`INSERT INTO public.seo_wp_migration_log (run_id, wp_id, level, action, message, detail) VALUES ($1,$2,$3,$4,$5,$6)`, [runId, wpId, level, action, message, detail ? JSON.stringify(detail) : null]);
  } catch { dbLogOk = false; }
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

/** Existing records win: match by wp_id, then slug (adopting the wp_id once). Nothing existing is overwritten. */
async function ensureAuthor(c: Ctx, wpId: number): Promise<string> {
  const u = c.bundle.users.find((x) => x.id === wpId);
  const slug = slugify(u?.slug || `author-${wpId}`);
  const byId = await c.client.query(`SELECT id FROM public.seo_authors WHERE wp_id = $1`, [wpId]);
  if (byId.rows[0]) return byId.rows[0].id;
  const bySlug = await c.client.query(`SELECT id FROM public.seo_authors WHERE slug = $1`, [slug]);
  if (bySlug.rows[0]) { await c.client.query(`UPDATE public.seo_authors SET wp_id = $1 WHERE id = $2 AND wp_id IS NULL`, [wpId, bySlug.rows[0].id]); return bySlug.rows[0].id; }
  const ins = await c.client.query(`INSERT INTO public.seo_authors (display_name, slug, bio_short, wp_id) VALUES ($1,$2,$3,$4) RETURNING id`, [(u?.name || `Author ${wpId}`).slice(0, 100), slug, u?.description?.slice(0, 600) || null, wpId]);
  return ins.rows[0].id;
}

async function ensureTerm(c: Ctx, table: 'seo_categories' | 'seo_tags', wpId: number): Promise<string | null> {
  const t = (table === 'seo_categories' ? c.bundle.categories : c.bundle.tags).find((x) => x.id === wpId);
  if (!t) return null;
  const slug = slugify(t.slug);
  const byId = await c.client.query(`SELECT id FROM public.${table} WHERE wp_id = $1`, [wpId]);
  if (byId.rows[0]) return byId.rows[0].id;
  const bySlug = await c.client.query(`SELECT id FROM public.${table} WHERE slug = $1`, [slug]);
  if (bySlug.rows[0]) { await c.client.query(`UPDATE public.${table} SET wp_id = $1 WHERE id = $2 AND wp_id IS NULL`, [wpId, bySlug.rows[0].id]); return bySlug.rows[0].id; }
  const ins = await c.client.query(`INSERT INTO public.${table} (name, slug, description, wp_id) VALUES ($1,$2,$3,$4) RETURNING id`, [t.name.slice(0, 100), slug, t.description || null, wpId]);
  return ins.rows[0].id;
}

async function ensureMedia(c: Ctx, f: NonNullable<TransformedPost['featured']>): Promise<string> {
  const found = await c.client.query(`SELECT id FROM public.seo_media WHERE wp_id = $1 OR storage_path = $2 LIMIT 1`, [f.wpId, f.url]);
  if (found.rows[0]) {
    // Media this migration created is repointed to the self-hosted copy; media it did not create is left alone.
    await c.client.query(`UPDATE public.seo_media SET storage_path = $3, filename = $4, width = $5, height = $6 WHERE id = $2 AND wp_id = $1`, [f.wpId, found.rows[0].id, f.url, f.filename.slice(0, 255), f.width, f.height]);
    return found.rows[0].id;
  }
  // storage_path is the self-hosted copy under /media/blog (WordPress is not referenced).
  const ins = await c.client.query(
    `INSERT INTO public.seo_media (filename, storage_path, mime_type, width, height, size_bytes, alt, caption, wp_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [f.filename.slice(0, 255), f.url, f.mime, f.width, f.height, f.size, f.alt.slice(0, 150), f.caption?.slice(0, 300) ?? null, f.wpId]
  );
  return ins.rows[0].id;
}

async function importOne(c: Ctx, t: TransformedPost, raw: ExportBundle['posts'][number]): Promise<'created' | 'updated' | 'unchanged'> {
  const { client } = c;
  const existing = await client.query(
    `SELECT p.id, s.content_sha256, s.wp_modified_gmt FROM public.seo_posts p LEFT JOIN public.seo_wp_post_source s ON s.post_id = p.id WHERE p.wp_id = $1`, [t.wpId]);
  const prior = existing.rows[0];
  if (prior && !force && prior.content_sha256 === t.contentSha256 && new Date(prior.wp_modified_gmt).toISOString() === t.modifiedAt) return 'unchanged';
  if (!prior) {
    const clash = await client.query(`SELECT id, wp_id FROM public.seo_posts WHERE slug = $1 AND status <> 'trashed'`, [t.slug]);
    if (clash.rows[0]) throw new Error(`slug "${t.slug}" already used by an unrelated post (${clash.rows[0].id}); not overwritten`);
  }

  const authorId = await ensureAuthor(c, t.authorWpId);
  const categoryIds: string[] = [];
  for (const id of t.categoryWpIds) { const x = await ensureTerm(c, 'seo_categories', id); if (x) categoryIds.push(x); }
  const tagIds: string[] = [];
  for (const id of t.tagWpIds) { const x = await ensureTerm(c, 'seo_tags', id); if (x) tagIds.push(x); }
  const wpCat = (t.primaryCategoryWpId && c.bundle.categories.find((x) => x.id === t.primaryCategoryWpId))
    || c.bundle.categories.find((x) => t.categoryWpIds.includes(x.id) && x.name === t.articleSection)
    || c.bundle.categories.find((x) => x.id === t.categoryWpIds[0]);
  const primaryId = wpCat ? await ensureTerm(c, 'seo_categories', wpCat.id) : null;
  const mediaId = t.featured ? await ensureMedia(c, t.featured) : null;

  const post = await client.query(
    `INSERT INTO public.seo_posts (status, title, slug, body_json, body_html, excerpt, featured_media_id, primary_category_id, published_at, modified_at,
        word_count, reading_time_min, template, wp_id, legacy_path, version, created_at)
     VALUES ('published',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'standard',$12,$13,1,$8)
     ON CONFLICT (wp_id) WHERE wp_id IS NOT NULL DO UPDATE SET
        title=EXCLUDED.title, slug=EXCLUDED.slug, body_json=EXCLUDED.body_json, body_html=EXCLUDED.body_html, excerpt=EXCLUDED.excerpt,
        featured_media_id=EXCLUDED.featured_media_id, primary_category_id=EXCLUDED.primary_category_id, published_at=EXCLUDED.published_at,
        modified_at=EXCLUDED.modified_at, word_count=EXCLUDED.word_count, reading_time_min=EXCLUDED.reading_time_min, legacy_path=EXCLUDED.legacy_path, updated_at=now()
     RETURNING id`,
    [t.title, t.slug, JSON.stringify({ blocks: [{ type: 'raw_html', data: { html: t.bodyHtml } }] }), t.bodyHtml, t.excerpt, mediaId, primaryId, t.publishedAt, t.modifiedAt, t.wordCount, t.readingTimeMin, t.wpId, t.legacyPath]
  );
  const postId: string = post.rows[0].id;

  await client.query(
    `INSERT INTO public.seo_post_seo (post_id, focus_keyword, additional_keywords, seo_title_raw, seo_title_effective, meta_description_raw, meta_description_effective, canonical_url,
        robots_index, robots_follow, robots_advanced, sitemap_include)
     VALUES ($1,$2,$11,$3,$4,$5,$6,$7,$8,$9,$10,true)
     ON CONFLICT (post_id) DO UPDATE SET focus_keyword=COALESCE(EXCLUDED.focus_keyword, public.seo_post_seo.focus_keyword), additional_keywords=EXCLUDED.additional_keywords, seo_title_raw=EXCLUDED.seo_title_raw,
        seo_title_effective=EXCLUDED.seo_title_effective, meta_description_raw=EXCLUDED.meta_description_raw, meta_description_effective=EXCLUDED.meta_description_effective,
        canonical_url=EXCLUDED.canonical_url, robots_index=EXCLUDED.robots_index, robots_follow=EXCLUDED.robots_follow, robots_advanced=EXCLUDED.robots_advanced`,
    [postId, t.seo.focusKeyword, t.seo.titleRaw, t.seo.titleRaw ?? '', t.seo.descriptionRaw, t.seo.descriptionRaw, t.seo.canonical, t.seo.robotsIndex, t.seo.robotsFollow, JSON.stringify(t.seo.robotsAdvanced), JSON.stringify(t.seo.additionalKeywords)]
  );
  await client.query(
    `INSERT INTO public.seo_post_social (post_id, use_seo_values, og_title, og_description, twitter_card, twitter_title, twitter_description)
     VALUES ($1,false,$2,$3,$4,$5,$6)
     ON CONFLICT (post_id) DO UPDATE SET use_seo_values=false, og_title=EXCLUDED.og_title, og_description=EXCLUDED.og_description, twitter_card=EXCLUDED.twitter_card,
        twitter_title=EXCLUDED.twitter_title, twitter_description=EXCLUDED.twitter_description`,
    [postId, t.social.ogTitle?.slice(0, 200) ?? null, t.social.ogDescription?.slice(0, 400) ?? null, t.social.twitterCard, t.social.twitterTitle?.slice(0, 200) ?? null, t.social.twitterDescription?.slice(0, 200) ?? null]
  );
  // Rank Math's JSON-LD is emitted verbatim from seo_wp_post_source; the generated graph is disabled to avoid duplicates.
  await client.query(
    `INSERT INTO public.seo_post_schema (post_id, disable_auto) VALUES ($1,true) ON CONFLICT (post_id) DO UPDATE SET disable_auto=true`, [postId]);

  await client.query(`DELETE FROM public.seo_post_authors WHERE post_id=$1`, [postId]);
  await client.query(`INSERT INTO public.seo_post_authors (post_id, author_id, position, role) VALUES ($1,$2,1,'author')`, [postId, authorId]);
  await client.query(`DELETE FROM public.seo_post_categories WHERE post_id=$1`, [postId]);
  for (const id of categoryIds) await client.query(`INSERT INTO public.seo_post_categories (post_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [postId, id]);
  await client.query(`DELETE FROM public.seo_post_tags WHERE post_id=$1`, [postId]);
  for (const id of tagIds) await client.query(`INSERT INTO public.seo_post_tags (post_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [postId, id]);

  await client.query(
    `INSERT INTO public.seo_wp_post_source (post_id, wp_id, wp_link, wp_path, wp_guid, wp_status, wp_date_gmt, wp_modified_gmt, wp_author_id, title_rendered, content_raw, content_rendered,
        excerpt_rendered, categories, tags, featured_media, rankmath, content_sha256, imported_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
     ON CONFLICT (post_id) DO UPDATE SET wp_link=EXCLUDED.wp_link, wp_path=EXCLUDED.wp_path, wp_guid=EXCLUDED.wp_guid, wp_status=EXCLUDED.wp_status, wp_date_gmt=EXCLUDED.wp_date_gmt,
        wp_modified_gmt=EXCLUDED.wp_modified_gmt, wp_author_id=EXCLUDED.wp_author_id, title_rendered=EXCLUDED.title_rendered, content_raw=EXCLUDED.content_raw,
        content_rendered=EXCLUDED.content_rendered, excerpt_rendered=EXCLUDED.excerpt_rendered, categories=EXCLUDED.categories, tags=EXCLUDED.tags,
        featured_media=EXCLUDED.featured_media, rankmath=EXCLUDED.rankmath, content_sha256=EXCLUDED.content_sha256, imported_at=now()`,
    [postId, t.wpId, raw.link, t.legacyPath, raw.guid?.rendered ?? null, raw.status, t.publishedAt, t.modifiedAt, raw.author, raw.title.rendered, raw.content.raw ?? null, raw.content.rendered,
      raw.excerpt.rendered, JSON.stringify(c.bundle.categories.filter((x) => t.categoryWpIds.includes(x.id))), JSON.stringify(c.bundle.tags.filter((x) => t.tagWpIds.includes(x.id))),
      t.featured ? JSON.stringify(t.featured) : null, JSON.stringify({ ...t.rankmath, jsonld: t.jsonld, _original: t.rankmathOriginal }), t.contentSha256]
  );
  return prior ? 'updated' : 'created';
}

/** Dry run: read-only comparison against the database, no writes. */
async function plan(t: TransformedPost): Promise<string> {
  try {
    const ex = await queryOne<{ id: string; content_sha256: string | null }>(`SELECT p.id, s.content_sha256 FROM public.seo_posts p LEFT JOIN public.seo_wp_post_source s ON s.post_id=p.id WHERE p.wp_id=$1`, [t.wpId]);
    if (ex) return ex.content_sha256 === t.contentSha256 ? 'unchanged' : 'would-update';
    const clash = await queryOne(`SELECT id FROM public.seo_posts WHERE slug=$1 AND status<>'trashed'`, [t.slug]);
    return clash ? 'CONFLICT: slug used by unrelated post' : 'would-create';
  } catch (e) {
    return `would-create (db check unavailable: ${(e as Error).message.slice(0, 60)})`;
  }
}

async function main() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  let bundle: ExportBundle;
  if (fs.existsSync(path.join(config.dataDir, config.exportFile))) bundle = loadExport();
  else if (dryRun) bundle = (await buildBundle()).bundle;
  else throw new Error('No export found. Run: npm run migrate:wp:export (a backup is required before import).');
  console.log(`${dryRun ? 'DRY RUN (no database writes)' : 'IMPORT'} · run ${runId} · ${bundle.posts.length} posts (export ${bundle.exportedAt})`);
  if (bundle.posts.length !== bundle.totalReported) throw new Error(`export has ${bundle.posts.length} posts but WordPress reported ${bundle.totalReported}`);

  let done = new Set<number>();
  if (resume && fs.existsSync(checkpointPath)) {
    const cp = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
    if (!cp.complete) { done = new Set<number>(cp.done); console.log(`resuming: ${done.size} already done`); }
  }

  const rows: Row[] = [];
  const transformed = bundle.posts.map((p) => ({ p, t: transformPost(p, bundle, bundle.rankmath[p.id] ?? null) }));
  for (let i = 0; i < transformed.length; i += config.batchSize) {
    const batch = transformed.slice(i, i + config.batchSize);
    for (const { p, t } of batch) {
      const base: Row = { wp_id: t.wpId, path: t.legacyPath, slug: t.slug, warnings: t.warnings };
      if (done.has(t.wpId)) { rows.push({ ...base, action: 'skipped (checkpoint)', error: '' }); continue; }
      try {
        let action: string;
        if (dryRun) action = await plan(t);
        else {
          // One transaction per post: a failure rolls back only that post and the run continues.
          action = await withTransaction((client) => importOne({ client, bundle }, t, p));
          done.add(t.wpId);
          fs.writeFileSync(checkpointPath, JSON.stringify({ runId, complete: false, done: [...done] }));
        }
        await log(action.startsWith('CONFLICT') ? 'error' : 'info', action, t.wpId, t.legacyPath, t.warnings.length ? { warnings: t.warnings } : undefined);
        rows.push({ ...base, action, error: action.startsWith('CONFLICT') ? action : '' });
        console.log(`  ${action.padEnd(14)} #${t.wpId} ${t.legacyPath}`);
      } catch (e) {
        const msg = (e as Error).message;
        await log('error', 'failed', t.wpId, msg);
        rows.push({ ...base, action: 'failed', error: msg });
        console.error(`  FAILED         #${t.wpId} ${t.legacyPath}: ${msg}`);
      }
    }
  }
  if (!dryRun) fs.writeFileSync(checkpointPath, JSON.stringify({ runId, complete: rows.every((r) => !r.error), done: [...done] }));

  const failures = (r: Row) => Boolean(r.error);
  const { base, failed } = writeReport(dryRun ? 'dry-run-report' : `import-report`, rows, { runId, dryRun, total: rows.length }, failures);
  const warnCount = rows.reduce((n, r) => n + (r.warnings as string[]).length, 0);
  console.log(`\n${rows.length} processed, ${failed.length} failed, ${warnCount} warnings. Report: ${base}.csv`);
  if (failed.length) process.exitCode = 1;
  await getDbPool().end().catch(() => undefined);
}

main().catch((e) => { console.error(e); process.exit(1); });
