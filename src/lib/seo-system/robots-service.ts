import { query } from './db';
import { testRobotsRule } from './workflow-service';
import { SITE_URL } from './technical-seo';

/** Hosts that may serve the production robots.txt. Everything else (staging, previews) is blocked (NFR-SEO-01). */
export function isProductionHost(host: string | null | undefined): boolean {
  if (!host) return true; // unknown host (e.g. tests): do not block
  const h = host.toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  return h === new URL(SITE_URL).host.replace(/^www\./, '');
}

export const BLOCK_ALL_ROBOTS = 'User-agent: *\nDisallow: /\n';

const KNOWN = new Set(['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay']);

export interface RobotsValidation {
  errors: string[];
  dangers: string[];
  warnings: string[];
}

/**
 * FR-TEC-004 validation: syntax errors block saving, "dangers" need the typed word CONFIRM,
 * warnings are advisory (noindex posts that robots.txt would hide from Google, blocked Bingbot, ...).
 */
export async function validateRobotsTxt(content: string): Promise<RobotsValidation> {
  const res: RobotsValidation = { errors: [], dangers: [], warnings: [] };
  if (Buffer.byteLength(content, 'utf8') > 500 * 1024) res.errors.push('robots.txt is larger than 500 KiB; Google ignores everything after that limit.');

  let inGroup = false;
  let lastWasAgent = false;
  content.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const idx = line.indexOf(':');
    if (idx < 0) {
      res.errors.push(`Line ${i + 1}: "${line}" is not a valid directive (expected "Directive: value").`);
      return;
    }
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!KNOWN.has(field)) {
      res.errors.push(`Line ${i + 1}: unknown directive "${field}". Use User-agent, Allow, Disallow or Sitemap.`);
      return;
    }
    if (field === 'user-agent') {
      inGroup = true;
      lastWasAgent = true;
      return;
    }
    if (field === 'sitemap') {
      if (!/^https?:\/\//i.test(value)) res.errors.push(`Line ${i + 1}: Sitemap URLs must be absolute (https://...).`);
      return;
    }
    if ((field === 'allow' || field === 'disallow') && !inGroup) res.errors.push(`Line ${i + 1}: "${field}" must come after a User-agent line.`);
    if (field === 'crawl-delay') res.warnings.push(`Line ${i + 1}: Crawl-delay is ignored by Google.`);
    if (field === 'disallow' && value === '/' ) lastWasAgent = false;
  });

  // Danger checks against real crawl paths
  for (const [agent, label] of [['Googlebot', 'Googlebot'], ['Bingbot', 'Bingbot'], ['SomeOtherBot', 'all crawlers (*)']] as const) {
    const root = testRobotsRule(content, '/', agent);
    if (!root.allowed) {
      const msg = `This blocks ${label} from the whole site (${root.matchedRule}).`;
      if (agent === 'SomeOtherBot') res.dangers.push(msg);
      else res.warnings.push(msg);
    }
  }
  for (const path of ['/blog', '/blog/example-post', '/_next/static/chunks/app.js', '/_next/static/css/app.css', '/media/example.jpg', '/uploads/example.jpg']) {
    const r = testRobotsRule(content, path, 'Googlebot');
    if (!r.allowed) res.dangers.push(`Googlebot would be blocked from ${path} (${r.matchedRule}); this can stop pages rendering or being indexed.`);
  }

  // Conflict check: noindex pages that robots.txt hides (Google could never see the noindex)
  try {
    const noindex = await query<{ slug: string; legacy_path: string | null }>(
      `SELECT p.slug, p.legacy_path FROM public.seo_posts p JOIN public.seo_post_seo s ON s.post_id = p.id
       WHERE p.status = 'published' AND s.robots_index = false`
    );
    for (const p of noindex) {
      const path = p.legacy_path || `/blog/${p.slug}`;
      if (!testRobotsRule(content, path, 'Googlebot').allowed) {
        res.warnings.push(`"${path}" is set to noindex but robots.txt blocks it, so Google cannot see the noindex rule.`);
      }
    }
  } catch {
    /* advisory only */
  }
  res.dangers = [...new Set(res.dangers)];
  return res;
}

/** Minimal line diff for the "review changes" preview (LCS on lines). */
export function lineDiff(before: string, after: string): Array<{ type: 'same' | 'add' | 'remove'; text: string }> {
  const a = before.split(/\r?\n/);
  const b = after.split(/\r?\n/);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Array<{ type: 'same' | 'add' | 'remove'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ type: 'remove', text: a[i++] });
    else out.push({ type: 'add', text: b[j++] });
  }
  while (i < a.length) out.push({ type: 'remove', text: a[i++] });
  while (j < b.length) out.push({ type: 'add', text: b[j++] });
  return out;
}

export async function listRobotsVersions(limit = 30) {
  return query(
    `SELECT v.id, v.active, v.note, v.created_at, u.email AS created_by, left(v.content, 4000) AS content
     FROM public.seo_robots_txt_versions v LEFT JOIN public.seo_users u ON u.id = v.created_by
     ORDER BY v.created_at DESC LIMIT $1`,
    [limit]
  );
}
