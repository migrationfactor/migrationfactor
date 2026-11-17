import fs from 'node:fs';
import path from 'node:path';
import { config, hasWpAuth } from './config';
import { wpGetAll } from './wordpress-client';
import { fetchMediaByIds } from './fetch-media';
import { fetchTaxonomies } from './fetch-taxonomies';
import { extractRankMath, type RankMathData } from './extract-rankmath';
import type { ExportBundle, WpPost } from './transform-post';

const POST_FIELDS = 'id,date,date_gmt,modified,modified_gmt,slug,status,link,guid,title,content,excerpt,author,featured_media,categories,tags,meta';

/** Published posts only, every page, validated against the X-WP-Total header. */
export async function fetchPosts() {
  const auth = hasWpAuth();
  const { items, total } = await wpGetAll<WpPost>('posts', { status: 'publish', _fields: POST_FIELDS, ...(auth ? { context: 'edit' } : {}) }, auth);
  const problems: string[] = [];
  if (items.length !== total) problems.push(`fetched ${items.length} posts but X-WP-Total reports ${total}`);
  const ids = new Set(items.map((p) => p.id));
  if (ids.size !== items.length) problems.push('duplicate post IDs in API response');
  const notPublished = items.filter((p) => p.status !== 'publish');
  if (notPublished.length) problems.push(`non-published posts returned: ${notPublished.map((p) => p.id).join(', ')}`);
  return { posts: items, total, authenticated: auth, problems };
}

export async function buildBundle(log = console.log): Promise<{ bundle: ExportBundle; problems: string[] }> {
  const { posts, total, authenticated, problems } = await fetchPosts();
  log(`posts: ${posts.length}/${total} (${authenticated ? 'edit context, raw content' : 'public context, rendered content only'})`);
  const media = await fetchMediaByIds(posts.map((p) => p.featured_media));
  const tax = await fetchTaxonomies();
  const rankmath: Record<string, RankMathData> = {};
  for (const p of posts) {
    try {
      rankmath[p.id] = await extractRankMath(p.link, p.meta);
    } catch (e) {
      problems.push(`rank math extraction failed for ${p.id} (${p.link}): ${(e as Error).message}`);
    }
  }
  return {
    bundle: { exportedAt: new Date().toISOString(), wpBaseUrl: config.wpBaseUrl, authenticated, totalReported: total, posts, media, ...tax, rankmath },
    problems,
  };
}

export const exportPath = () => path.join(config.dataDir, config.exportFile);

export function loadExport(): ExportBundle {
  if (!fs.existsSync(exportPath())) throw new Error(`No export found at ${exportPath()}. Run: npm run migrate:wp:export`);
  return JSON.parse(fs.readFileSync(exportPath(), 'utf8')) as ExportBundle;
}

async function main() {
  const command = process.argv[2];
  const { bundle, problems } = await buildBundle();
  if (command === 'export') {
    fs.mkdirSync(config.dataDir, { recursive: true });
    if (fs.existsSync(exportPath())) fs.copyFileSync(exportPath(), path.join(config.dataDir, `export-${Date.now()}.bak.json`));
    fs.writeFileSync(exportPath(), JSON.stringify(bundle, null, 2));
    console.log(`export written: ${exportPath()}`);
  } else {
    console.log(`\nWordPress: ${bundle.wpBaseUrl}`);
    for (const p of bundle.posts) {
      const rm = bundle.rankmath[p.id];
      console.log(`  #${p.id} ${new URL(p.link).pathname}  cats=[${p.categories}] tags=[${p.tags}] img=${p.featured_media}  chars=${p.content.rendered.length}  rankmath=${rm ? (rm.missing.filter((m) => !m.startsWith('focus_keyword')).length ? 'PARTIAL' : 'ok') : 'MISSING'}`);
    }
    const fk = Object.values(bundle.rankmath).filter((r) => !r.focus_keyword).length;
    console.log(`\ncategories: ${bundle.categories.length}, tags: ${bundle.tags.length}, users: ${bundle.users.length}, media: ${bundle.media.length}`);
    if (fk) console.log(`focus keyword unavailable for ${fk}/${bundle.posts.length} posts (not exposed by REST). Install scripts/wordpress-migration/rankmath-rest.php and set WP_USERNAME / WP_APP_PASSWORD.`);
  }
  if (problems.length) { console.error('\nPROBLEMS:\n - ' + problems.join('\n - ')); process.exitCode = 1; }
}

if (process.argv[1]?.endsWith('fetch-posts.ts')) main().catch((e) => { console.error(e); process.exit(1); });
