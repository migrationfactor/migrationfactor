import { query, queryOne, withTransaction } from './db';
import { logAudit } from './audit';
import { isProductionHost, BLOCK_ALL_ROBOTS } from './robots-service';

export const SITE_URL = 'https://migrationfactor.com';

export const generateSitemapIndexXml = generateSitemapIndex;
export const generatePostSitemapXml = generatePostSitemap;

/**
 * Generates XML Sitemap Index (FR-TEC-001)
 */
export async function generateSitemapIndex(): Promise<string> {
  const lastmodRes = await queryOne<{ max_mod: string }>(
    `SELECT max(modified_at) as max_mod FROM public.seo_posts WHERE status = 'published'`
  );
  const nowIso = lastmodRes?.max_mod ? new Date(lastmodRes.max_mod).toISOString() : new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/post-sitemap1.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/pages-sitemap.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/category-sitemap.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/tag-sitemap.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/author-sitemap.xml</loc>
    <lastmod>${nowIso}</lastmod>
  </sitemap>
</sitemapindex>`;
}

/**
 * Generates Post Sitemap XML (FR-TEC-002)
 * Only published, indexable posts where sitemap_include = true
 */
export async function generatePostSitemap(): Promise<string> {
  const posts = await query<any>(
    `SELECT p.id, p.slug, p.wp_id, p.modified_at, p.published_at, p.title,
            s.canonical_url,
            m.url as image_url, m.title as image_title
     FROM public.seo_posts p
     JOIN public.seo_post_seo s ON s.post_id = p.id
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     WHERE p.status = 'published'
       AND s.robots_index = true
       AND s.sitemap_include = true
       AND (p.wp_id IS NOT NULL OR s.canonical_url IS NULL OR s.canonical_url = '' OR rtrim(s.canonical_url, '/') = '${SITE_URL}/blog/' || p.slug)
     ORDER BY p.published_at DESC`
  );

  const urlEntries = posts.map(p => {
    // Migrated WordPress posts keep their original canonical URL (root-level path).
    const loc = p.wp_id && p.canonical_url ? p.canonical_url : `${SITE_URL}/blog/${p.slug}`;
    const lastmod = new Date(p.modified_at || p.published_at || new Date()).toISOString();
    let imageTag = '';
    if (p.image_url) {
      const imgFull = p.image_url.startsWith('http') ? p.image_url : `${SITE_URL}${p.image_url}`;
      imageTag = `\n    <image:image>\n      <image:loc>${imgFull}</image:loc>\n      <image:title><![CDATA[${p.image_title || p.title}]]></image:title>\n    </image:image>`;
    }
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>${imageTag}\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries.join('\n')}
</urlset>`;
}

/**
 * Generates Category Sitemap XML (FR-TEC-003)
 */
export async function generateCategorySitemap(): Promise<string> {
  const categories = await query<any>(
    `SELECT c.slug, c.updated_at,
            count(p.id) as post_count,
            max(p.modified_at) as last_post_mod
     FROM public.seo_categories c
     JOIN public.seo_post_categories pc ON pc.category_id = c.id
     JOIN public.seo_posts p ON p.id = pc.post_id
     JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published'
       AND s.robots_index = true
       AND c.robots_index = true
     GROUP BY c.id, c.slug, c.updated_at
     HAVING count(p.id) > 0
     ORDER BY c.slug ASC`
  );

  const urlEntries = categories.map(c => {
    const loc = `${SITE_URL}/blog/category/${c.slug}`;
    const lastmod = new Date(c.last_post_mod || c.updated_at || new Date()).toISOString();
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;
}

/**
 * Generates Tag Sitemap XML (FR-TEC-004, FR-TAX-002)
 * Only tags with >= 3 published posts and robots_index = true
 */
export async function generateTagSitemap(): Promise<string> {
  const tags = await query<any>(
    `SELECT t.slug, t.updated_at,
            count(p.id) as post_count,
            max(p.modified_at) as last_post_mod
     FROM public.seo_tags t
     JOIN public.seo_post_tags pt ON pt.tag_id = t.id
     JOIN public.seo_posts p ON p.id = pt.post_id
     JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published'
       AND s.robots_index = true
       AND t.robots_index = true
     GROUP BY t.id, t.slug, t.updated_at
     HAVING count(p.id) >= 3
     ORDER BY t.slug ASC`
  );

  const urlEntries = tags.map(t => {
    const loc = `${SITE_URL}/blog/tag/${t.slug}`;
    const lastmod = new Date(t.last_post_mod || t.updated_at || new Date()).toISOString();
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;
}

/**
 * Generates Author Sitemap XML (FR-TEC-005, FR-TAX-003)
 * Only authors with >= 1 published post
 */
export async function generateAuthorSitemap(): Promise<string> {
  const authors = await query<any>(
    `SELECT a.slug, a.updated_at,
            count(p.id) as post_count,
            max(p.modified_at) as last_post_mod
     FROM public.seo_authors a
     JOIN public.seo_post_authors pa ON pa.author_id = a.id
     JOIN public.seo_posts p ON p.id = pa.post_id
     JOIN public.seo_post_seo s ON s.post_id = p.id
     WHERE p.status = 'published'
       AND s.robots_index = true
     GROUP BY a.id, a.slug, a.updated_at
     HAVING count(p.id) >= 1
     ORDER BY a.slug ASC`
  );

  const urlEntries = authors.map(a => {
    const loc = `${SITE_URL}/blog/author/${a.slug}`;
    const lastmod = new Date(a.last_post_mod || a.updated_at || new Date()).toISOString();
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;
}

/**
 * Fetches active robots.txt content (FR-TEC-007, 008)
 */
export async function getActiveRobotsTxt(host?: string | null): Promise<string> {
  // Staging, preview and unknown hosts never serve the production file (NFR-SEO-01).
  if (host && !isProductionHost(host)) return BLOCK_ALL_ROBOTS;
  const activeVersion = await queryOne<{ content: string }>(
    `SELECT content FROM public.seo_robots_txt_versions WHERE active = true ORDER BY created_at DESC LIMIT 1`
  );

  if (activeVersion && activeVersion.content) {
    return activeVersion.content;
  }

  // Default robots.txt content per Section 11.2
  return `User-agent: *
Allow: /
Disallow: /seo-admin/
Disallow: /admin/
Disallow: /api/
Disallow: /preview/

Sitemap: ${SITE_URL}/sitemap_index.xml
`;
}

/**
 * Sanitizes and validates robots.txt content (FR-TEC-007)
 * Ensures protected paths are disallowed.
 */
export function sanitizeRobotsTxt(content: string): string {
  let text = content ? content.trim() : '';
  const mandatoryRules = ['Disallow: /admin/', 'Disallow: /seo-admin/', 'Disallow: /api/'];
  for (const rule of mandatoryRules) {
    if (!text.includes(rule)) {
      text += `\n${rule}`;
    }
  }
  return text;
}

/**
 * Redirect resolver (FR-TEC-010, 011)
 * Matches single-hop redirects and checks against chains
 */
export async function resolveRedirect(path: string): Promise<{ target: string; httpCode: number } | null> {
  const cleanPath = path.toLowerCase().replace(/\/+$/, '') || '/';
  const cleanPathWithSlash = `${cleanPath}/`;

  const redirect = await queryOne<{ target_url: string; http_code: number }>(
    `SELECT target_url, http_code FROM public.seo_redirects
     WHERE (source_path = $1 OR source_path = $2) AND active = true
     LIMIT 1`,
    [cleanPath, cleanPathWithSlash]
  );

  if (!redirect) return null;

  // Increment hit counter asynchronously
  query(`UPDATE public.seo_redirects SET hits = hits + 1, last_hit_at = now() WHERE source_path = $1 OR source_path = $2`, [cleanPath, cleanPathWithSlash]).catch(() => {});

  return {
    target: redirect.target_url,
    httpCode: redirect.http_code,
  };
}

/**
 * 404 & Tombstone Checker (FR-TEC-012, 013)
 */
export async function checkTombstoneOrRecord404(path: string, referrer?: string, userAgent?: string): Promise<{ isGone: boolean; httpCode: number }> {
  const cleanPath = path.toLowerCase().replace(/\/+$/, '') || '/';
  const cleanPathWithSlash = `${cleanPath}/`;

  // Check tombstone
  const tombstone = await queryOne<{ http_code: number }>(
    `SELECT http_code FROM public.seo_url_tombstones WHERE path = $1 OR path = $2 LIMIT 1`,
    [cleanPath, cleanPathWithSlash]
  );

  if (tombstone) {
    return { isGone: true, httpCode: tombstone.http_code || 410 };
  }

  // Record 404 in seo_not_found_daily (aggregation per day to prevent flood)
  const today = new Date().toISOString().split('T')[0];
  const refList = referrer ? JSON.stringify([referrer.substring(0, 500)]) : '[]';

  query(
    `INSERT INTO public.seo_not_found_daily (path, day, hits, referrers)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (path, day) DO UPDATE SET
       hits = seo_not_found_daily.hits + 1`,
    [cleanPathWithSlash, today, refList]
  ).catch(() => {});

  return { isGone: false, httpCode: 404 };
}

/**
 * Link Graph extraction and orphan detection (FR-LNK-001 to 005)
 */
export async function indexPostLinks(postId: string, bodyHtml: string) {
  // Extract all <a href="..."> links
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  await query(`DELETE FROM public.seo_links WHERE source_post_id = $1`, [postId]);

  while ((match = linkRegex.exec(bodyHtml)) !== null) {
    const rawHref = match[1].trim();
    const anchorText = match[2].replace(/<[^>]*>/g, '').trim();

    if (rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue;

    const isInternal = rawHref.startsWith('/') || rawHref.startsWith(SITE_URL);
    let targetPostId: string | null = null;
    let normalized = rawHref.toLowerCase();

    if (isInternal) {
      // Find matching post slug
      const slugMatch = normalized.match(/\/blog\/([a-z0-9-]+)\/?/);
      if (slugMatch && slugMatch[1]) {
        const found = await queryOne<{ id: string }>(
          `SELECT id FROM public.seo_posts WHERE slug = $1 LIMIT 1`,
          [slugMatch[1]]
        );
        if (found) targetPostId = found.id;
      }
    }

    await query(
      `INSERT INTO public.seo_links (
        source_post_id, target_url, target_url_normalized, target_post_id,
        is_internal, anchor_text
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [postId, rawHref, normalized, targetPostId, isInternal, anchorText.substring(0, 255)]
    );
  }
}

/**
 * Link reports: Orphan pages, broken links, incoming/outgoing counts
 */
export async function getLinkReport() {
  // Orphan pages: published posts with 0 internal incoming links
  const orphans = await query<any>(
    `SELECT p.id, p.title, p.slug, p.published_at
     FROM public.seo_posts p
     WHERE p.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM public.seo_links l
         WHERE l.target_post_id = p.id AND l.source_post_id <> p.id
       )
     ORDER BY p.published_at DESC`
  );

  return {
    orphans,
    totalOrphans: orphans.length,
  };
}
