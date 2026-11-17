import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { loadExport } from './fetch-posts';
import { MEDIA_DIR, MEDIA_URL_PREFIX, manifestPath } from './rewrite-urls';

/**
 * Downloads every image the migrated posts reference (featured, in-content incl. srcset sizes, Open Graph / Twitter / JSON-LD,
 * author avatar) into public/media/blog so the site has zero runtime dependency on WordPress. Originals are copied byte-for-byte;
 * nothing on WordPress is modified or deleted. Idempotent: existing, valid files are kept.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EXT_BY_TYPE: Record<string, string> = { 'image/webp': '.webp', 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif' };

export function collectMediaUrls(text: string): string[] {
  const plain = text.split(String.fromCharCode(92) + '/').join('/'); // un-escape JSON "\/"
  const uploads = plain.match(/https?:\/\/(?:www\.)?migrationfactor\.com\.au\/wp-content\/uploads\/[^"'\\<>\s),]+/gi) ?? [];
  const avatars = plain.match(/https?:\/\/secure\.gravatar\.com\/avatar\/[^"'\\<>\s),]+/gi) ?? [];
  return [...new Set([...uploads, ...avatars])];
}

function sniff(buf: Buffer): string | null {
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 6 && buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (buf.toString('utf8', 0, 200).includes('<svg')) return 'image/svg+xml';
  return null;
}

async function download(url: string): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const res = await fetch(url.split('&amp;').join('&'), { headers: { 'User-Agent': 'MigrationFactor-WP-Migration/1.0' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`) as Error & { fatal: boolean }; e.fatal = true; throw e; }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      if ((e as { fatal?: boolean }).fatal || attempt === config.maxRetries) break;
      await sleep(config.baseDelayMs * 2 ** attempt);
    }
  }
  throw new Error(`${url}: ${(last as Error).message}`);
}

function localRelPath(url: string, type: string): string {
  const u = new URL(url.split('&amp;').join('&'));
  const m = /\/wp-content\/uploads\/(.+)$/i.exec(u.pathname);
  if (m) return decodeURIComponent(m[1]);
  return `authors/gravatar-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}${EXT_BY_TYPE[type] ?? '.jpg'}`;
}

async function main() {
  const bundle = loadExport();
  const urls = collectMediaUrls(JSON.stringify(bundle.posts.map((p) => [p.content.rendered, p.excerpt.rendered])) + JSON.stringify(bundle.rankmath) + JSON.stringify(bundle.media));
  console.log(`${urls.length} distinct image URLs referenced`);
  const manifest: Array<Record<string, unknown>> = [];
  const failures: string[] = [];
  for (const url of urls) {
    try {
      // Reuse an existing valid file when the target path is deterministic (uploads); avatars are re-fetched (single small file).
      let rel = /wp-content\/uploads\//i.test(url) ? localRelPath(url, '') : '';
      let buf: Buffer | null = null;
      if (rel && fs.existsSync(path.join(MEDIA_DIR, rel)) && sniff(fs.readFileSync(path.join(MEDIA_DIR, rel)))) buf = fs.readFileSync(path.join(MEDIA_DIR, rel));
      if (!buf) buf = await download(url);
      const type = sniff(buf);
      if (!type || buf.length === 0) throw new Error('downloaded file is not a valid image');
      if (!rel) rel = localRelPath(url, type);
      const file = path.join(MEDIA_DIR, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(buf)) fs.writeFileSync(file, buf);
      manifest.push({ url, localPath: `${MEDIA_URL_PREFIX}/${rel.split(path.sep).join('/')}`, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), contentType: type });
      console.log(`  ok  ${String(buf.length).padStart(8)}  ${rel}`);
    } catch (e) {
      failures.push((e as Error).message);
      console.error(`  FAILED ${(e as Error).message}`);
    }
  }
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length}/${urls.length} images stored under public/media/blog; manifest: ${manifestPath()}`);
  if (failures.length) { console.error(`\n${failures.length} FAILED:\n - ${failures.join('\n - ')}`); process.exitCode = 1; }
}

if (process.argv[1]?.endsWith('localize-media.ts')) main().catch((e) => { console.error(e); process.exit(1); });
