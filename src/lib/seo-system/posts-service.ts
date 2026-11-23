import { query, queryOne, withTransaction } from './db';
import { logAudit } from './audit';
import { runContentAnalysis, calculateFleschScore } from './analysis';
import { renderBlocksToHtml, ContentBlock, slugifyHeading } from './sanitizer';
import { SITE_URL } from './technical-seo';
import { getSeoSettings } from './settings-service';
import { MIN_FEATURED_WIDTH } from './image-meta';
import { reindexPostLinks } from './link-service';
import { validateSchemaGraph, validateCustomJsonLd } from './schema-service';
import { renderSeoHead } from './head-service';

export interface PostListFilters {
  status?: string;
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  scoreBand?: '0-49' | '50-79' | '80-100' | 'not_analyzed';
  robotsIndex?: boolean;
  sitemapInclude?: boolean;
  orphans?: boolean;
  createdBy?: string;
  pillar?: boolean;
  month?: string;
  currentUserId?: string;
  missing?: 'meta_description' | 'focus_keyword' | 'featured_image';
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'published_at' | 'modified_at' | 'created_at' | 'seo_score' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePostInput {
  title: string;
  slug?: string;
  bodyJson?: { blocks: ContentBlock[] };
  excerpt?: string;
  featuredMediaId?: string | null;
  featuredAltOverride?: string | null;
  featuredCaptionOverride?: string | null;
  primaryCategoryId?: string | null;
  categoryIds?: string[];
  tagIds?: string[];
  authorIds?: string[];
  template?: string;
  // SEO fields
  focusKeyword?: string | null;
  additionalKeywords?: string[];
  seoTitleRaw?: string | null;
  metaDescriptionRaw?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  robotsAdvanced?: any;
  breadcrumbTitle?: string | null;
  customH1?: string | null;
  sitemapInclude?: boolean;
  isCornerstone?: boolean;
  // Social
  useSeoValues?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageMediaId?: string | null;
  twitterCard?: string;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageMediaId?: string | null;
  // Schema
  articleType?: string;
  headlineOverride?: string | null;
  descriptionOverride?: string | null;
  faqEnabled?: boolean;
  howtoEnabled?: boolean;
  customJsonld?: any;
  customMode?: string;
  disableAuto?: boolean;
  // GEO / AEO
  reviewedBy?: string | null;
  primaryQuestion?: string | null;
  relatedQuestions?: string[];
  answerSummary?: string | null;
  intent?: string;
  primaryEntity?: any;
  secondaryEntities?: any[];
  originalInsight?: boolean;
  insightNote?: string | null;
  reviewIntervalMonths?: number;
  // References
  references?: Array<{
    title: string;
    url: string;
    publisher?: string;
    publishedDate?: string;
    note?: string;
  }>;
}

/**
 * Generates a clean URL slug from title
 */
export function validateCanonicalUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    const err: any = new Error('Canonical URL must be an absolute URL such as https://migrationfactor.com/blog/my-post/.');
    err.status = 422;
    throw err;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    const err: any = new Error('Canonical URL must use https:// (javascript:, data: and other schemes are rejected).');
    err.status = 422;
    throw err;
  }
  if (url.hash) {
    const err: any = new Error('Canonical URL must not contain a #fragment.');
    err.status = 422;
    throw err;
  }
  return url.toString();
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .substring(0, 150);
}

/**
 * Ensures slug uniqueness among non-trashed posts
 */
export async function ensureUniqueSlug(slug: string, excludePostId?: string): Promise<string> {
  let baseSlug = slug || 'untitled-post';
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM public.seo_posts 
       WHERE slug = $1 AND status <> 'trashed' ${excludePostId ? 'AND id <> $2' : ''} LIMIT 1`,
      excludePostId ? [candidate, excludePostId] : [candidate]
    );

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * List posts with filters, score ranges, and status counts (FR-BLG-013)
 */
export async function listPosts(filters: PostListFilters = {}) {
  const {
    status,
    categoryId,
    tagId,
    authorId,
    scoreBand,
    robotsIndex,
    sitemapInclude,
    orphans,
    createdBy,
    pillar,
    month,
    currentUserId,
    missing,
    search,
    limit = 20,
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = filters;

  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (status && status !== 'all') {
    whereClauses.push(`p.status = $${paramIdx++}`);
    params.push(status);
  } else if (!status || status === 'all') {
    // By default hide trashed from 'all'
    whereClauses.push(`p.status <> 'trashed'`);
  }

  if (categoryId) {
    whereClauses.push(`EXISTS (SELECT 1 FROM public.seo_post_categories pc WHERE pc.post_id = p.id AND pc.category_id = $${paramIdx++})`);
    params.push(categoryId);
  }

  if (createdBy) {
    whereClauses.push(`p.created_by = $${paramIdx++}`);
    params.push(createdBy);
  }
  if (pillar) {
    whereClauses.push(`s.is_cornerstone = true`);
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    whereClauses.push(`to_char(COALESCE(p.published_at, p.created_at), 'YYYY-MM') = $${paramIdx++}`);
    params.push(month);
  }
  if (orphans) {
    whereClauses.push(`p.status = 'published' AND NOT EXISTS (SELECT 1 FROM public.seo_links l WHERE l.target_post_id = p.id AND l.source_post_id <> p.id)`);
  }

  if (tagId) {
    whereClauses.push(`EXISTS (SELECT 1 FROM public.seo_post_tags pt WHERE pt.post_id = p.id AND pt.tag_id = $${paramIdx++})`);
    params.push(tagId);
  }

  if (authorId) {
    whereClauses.push(`EXISTS (SELECT 1 FROM public.seo_post_authors pa WHERE pa.post_id = p.id AND pa.author_id = $${paramIdx++})`);
    params.push(authorId);
  }

  if (robotsIndex !== undefined) {
    whereClauses.push(`s.robots_index = $${paramIdx++}`);
    params.push(robotsIndex);
  }

  if (sitemapInclude !== undefined) {
    whereClauses.push(`s.sitemap_include = $${paramIdx++}`);
    params.push(sitemapInclude);
  }

  if (missing === 'meta_description') {
    whereClauses.push(`(s.meta_description_raw IS NULL OR trim(s.meta_description_raw) = '')`);
  } else if (missing === 'focus_keyword') {
    whereClauses.push(`(s.focus_keyword IS NULL OR trim(s.focus_keyword) = '')`);
  } else if (missing === 'featured_image') {
    whereClauses.push(`p.featured_media_id IS NULL`);
  }

  if (scoreBand) {
    if (scoreBand === '0-49') {
      whereClauses.push(`a.overall < 50`);
    } else if (scoreBand === '50-79') {
      whereClauses.push(`a.overall >= 50 AND a.overall < 80`);
    } else if (scoreBand === '80-100') {
      whereClauses.push(`a.overall >= 80`);
    } else if (scoreBand === 'not_analyzed') {
      whereClauses.push(`a.overall IS NULL`);
    }
  }

  if (search) {
    whereClauses.push(`(
      p.title ILIKE $${paramIdx} 
      OR p.slug ILIKE $${paramIdx} 
      OR s.focus_keyword ILIKE $${paramIdx}
      OR p.body_html ILIKE $${paramIdx}
    )`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Order mapping
  let orderColumn = 'p.created_at';
  if (sortBy === 'published_at') orderColumn = 'p.published_at';
  else if (sortBy === 'modified_at') orderColumn = 'p.modified_at';
  else if (sortBy === 'title') orderColumn = 'p.title';
  else if (sortBy === 'seo_score') orderColumn = 'a.overall';

  const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const orderSql = `ORDER BY ${orderColumn} ${orderDirection} NULLS LAST`;

  // Fetch count
  const countRes = await queryOne<{ count: string }>(
    `SELECT count(p.id) as count
     FROM public.seo_posts p
     LEFT JOIN public.seo_post_seo s ON s.post_id = p.id
     LEFT JOIN public.seo_analysis a ON a.post_id = p.id
     ${whereSql}`,
    params
  );
  const total = parseInt(countRes?.count || '0', 10);

  // Fetch posts
  const listSql = `
    SELECT 
      p.id, p.status, p.title, p.slug, p.excerpt, p.version, p.word_count, p.reading_time_min,
      p.published_at, p.modified_at, p.scheduled_at, p.created_at, p.featured_media_id, p.legacy_path,
      m.storage_path as featured_image_url, m.alt as featured_image_alt,
      s.focus_keyword, s.seo_title_effective, s.meta_description_effective,
      s.robots_index, s.sitemap_include, s.canonical_url,
      a.overall as seo_score, a.basic as seo_basic, a.additional as seo_additional,
      a.readability as seo_readability, a.technical as seo_technical,
      a.geo as geo_score, a.aeo as aeo_score,
      (SELECT a2.display_name FROM public.seo_post_authors pa2 JOIN public.seo_authors a2 ON a2.id = pa2.author_id WHERE pa2.post_id = p.id ORDER BY pa2.position LIMIT 1) AS author_name,
      (SELECT string_agg(c2.name, ', ' ORDER BY c2.name) FROM public.seo_post_categories pc2 JOIN public.seo_categories c2 ON c2.id = pc2.category_id WHERE pc2.post_id = p.id) AS category_names,
      (SELECT sc.article_type FROM public.seo_post_schema sc WHERE sc.post_id = p.id) AS schema_type,
      (SELECT count(*) FROM public.seo_links l WHERE l.source_post_id = p.id AND l.is_internal) AS links_internal,
      (SELECT count(*) FROM public.seo_links l WHERE l.source_post_id = p.id AND NOT l.is_internal) AS links_external,
      (SELECT count(*) FROM public.seo_links l WHERE l.target_post_id = p.id AND l.source_post_id <> p.id) AS links_incoming
    FROM public.seo_posts p
    LEFT JOIN public.seo_post_seo s ON s.post_id = p.id
    LEFT JOIN public.seo_analysis a ON a.post_id = p.id
    LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
    ${whereSql}
    ${orderSql}
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const posts = await query(listSql, [...params, limit, offset]);

  // Status counts for tabs
  const statusCountsRes = await query<{ status: string; count: string }>(
    `SELECT status, count(*) as count FROM public.seo_posts GROUP BY status`
  );

  const statusCounts: Record<string, number> = {
    all: 0,
    published: 0,
    draft: 0,
    pending_review: 0,
    scheduled: 0,
    unpublished: 0,
    trashed: 0,
  };

  for (const row of statusCountsRes) {
    const c = parseInt(row.count, 10);
    if (row.status !== 'trashed') {
      statusCounts.all += c;
    }
    if (statusCounts[row.status] !== undefined) {
      statusCounts[row.status] = c;
    }
  }

  const mineRow = currentUserId ? await queryOne<{ n: string }>(`SELECT count(*) AS n FROM public.seo_posts WHERE created_by = $1 AND status <> 'trashed'`, [currentUserId]) : null;
  const pillarRow = await queryOne<{ n: string }>(`SELECT count(*) AS n FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id WHERE s.is_cornerstone = true AND p.status <> 'trashed'`);
  const monthRows = await query<{ m: string }>(`SELECT DISTINCT to_char(COALESCE(published_at, created_at), 'YYYY-MM') AS m FROM public.seo_posts WHERE status <> 'trashed' ORDER BY m DESC`);

  return {
    posts,
    total,
    mineCount: parseInt(mineRow?.n || '0', 10),
    pillarCount: parseInt(pillarRow?.n || '0', 10),
    months: monthRows.map((r) => r.m),
    statusCounts,
    limit,
    offset,
  };
}

/**
 * Fetch full post record with all SEO, social, schema, GEO/AEO, and taxonomies
 */
export async function getPost(id: string) {
  const post = await queryOne<any>(
    `SELECT p.*, 
            m.storage_path as featured_media_url, m.alt as featured_media_alt, m.width as featured_media_width, m.height as featured_media_height,
            u.name as creator_name
     FROM public.seo_posts p
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_users u ON u.id = p.created_by
     WHERE p.id = $1`,
    [id]
  );

  if (!post) return null;

  const seo = await queryOne<any>(`SELECT * FROM public.seo_post_seo WHERE post_id = $1`, [id]);
  const social = await queryOne<any>(`SELECT * FROM public.seo_post_social WHERE post_id = $1`, [id]);
  const schema = await queryOne<any>(`SELECT * FROM public.seo_post_schema WHERE post_id = $1`, [id]);
  const geoAeo = await queryOne<any>(`SELECT * FROM public.seo_post_geo_aeo WHERE post_id = $1`, [id]);
  const analysis = await queryOne<any>(`SELECT * FROM public.seo_analysis WHERE post_id = $1`, [id]);

  const authors = await query<any>(
    `SELECT pa.position, pa.role, a.id, a.display_name, a.slug, a.job_title
     FROM public.seo_post_authors pa
     JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE pa.post_id = $1 ORDER BY pa.position ASC`,
    [id]
  );

  const categories = await query<any>(
    `SELECT c.id, c.name, c.slug, (c.id = $2) as is_primary
     FROM public.seo_post_categories pc
     JOIN public.seo_categories c ON c.id = pc.category_id
     WHERE pc.post_id = $1`,
    [id, post.primary_category_id]
  );

  const tags = await query<any>(
    `SELECT t.id, t.name, t.slug
     FROM public.seo_post_tags pt
     JOIN public.seo_tags t ON t.id = pt.tag_id
     WHERE pt.post_id = $1`,
    [id]
  );

  const references = await query<any>(
    `SELECT * FROM public.seo_post_references WHERE post_id = $1 ORDER BY position ASC`,
    [id]
  );

  const editLock = await queryOne<any>(
    `SELECT l.acquired_at, l.heartbeat_at, u.name as locked_by_name, u.id as locked_by_id
     FROM public.seo_edit_locks l
     JOIN public.seo_users u ON u.id = l.user_id
     WHERE l.post_id = $1 AND l.heartbeat_at > now() - interval '2 minutes'`,
    [id]
  );

  return {
    ...post,
    seo,
    social,
    schema,
    geo_aeo: geoAeo,
    analysis,
    authors,
    categories,
    tags,
    references,
    edit_lock: editLock,
  };
}

/**
 * Creates a new draft blog post (FR-BLG-001)
 */
async function createDraftCore(actorId: string, input: CreatePostInput) {
  if (!input.title || input.title.trim().length === 0) {
    throw new Error('Add a post title before saving.');
  }

  input = { ...input, canonicalUrl: validateCanonicalUrl(input.canonicalUrl) };

  const rawSlug = input.slug || generateSlug(input.title);
  const finalSlug = await ensureUniqueSlug(rawSlug);

  const blocks = input.bodyJson?.blocks || [];
  const { html, wordCount, readingTimeMin, headings } = renderBlocksToHtml(blocks);

  // SEO Fallbacks per Section 6.2
  const effectiveTitle = input.seoTitleRaw || `${input.title} - Migration Factor`;
  const effectiveDesc = input.metaDescriptionRaw || input.excerpt || '';

  return await withTransaction(async (client) => {
    // 1. Insert post
    const postRes = await client.query(
      `INSERT INTO public.seo_posts (
        title, slug, body_json, body_html, excerpt,
        featured_media_id, featured_alt_override, featured_caption_override,
        primary_category_id, template, word_count, reading_time_min,
        created_by, status, version
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, 'draft', 1
      ) RETURNING *`,
      [
        input.title.trim(),
        finalSlug,
        JSON.stringify({ blocks }),
        html,
        input.excerpt || null,
        input.featuredMediaId || null,
        input.featuredAltOverride || null,
        input.featuredCaptionOverride || null,
        input.primaryCategoryId || null,
        input.template || 'standard',
        wordCount,
        readingTimeMin,
        actorId,
      ]
    );
    const post = postRes.rows[0];

    // 2. Insert SEO
    await client.query(
      `INSERT INTO public.seo_post_seo (
        post_id, focus_keyword, additional_keywords,
        seo_title_raw, seo_title_effective,
        meta_description_raw, meta_description_effective,
        canonical_url, robots_index, robots_follow, robots_advanced,
        breadcrumb_title, custom_h1, sitemap_include, is_cornerstone
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15
      )`,
      [
        post.id,
        input.focusKeyword || null,
        JSON.stringify(input.additionalKeywords || []),
        input.seoTitleRaw || null,
        effectiveTitle,
        input.metaDescriptionRaw || null,
        effectiveDesc,
        input.canonicalUrl || null,
        input.robotsIndex !== false,
        input.robotsFollow !== false,
        JSON.stringify(input.robotsAdvanced || {}),
        input.breadcrumbTitle || null,
        input.customH1 || null,
        input.sitemapInclude !== false,
        input.isCornerstone || false,
      ]
    );

    // 3. Insert Social
    await client.query(
      `INSERT INTO public.seo_post_social (
        post_id, use_seo_values, og_title, og_description, og_image_media_id,
        twitter_card, twitter_title, twitter_description, twitter_image_media_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        post.id,
        input.useSeoValues !== false,
        input.ogTitle || null,
        input.ogDescription || null,
        input.ogImageMediaId || null,
        input.twitterCard || 'summary_large_image',
        input.twitterTitle || null,
        input.twitterDescription || null,
        input.twitterImageMediaId || null,
      ]
    );

    // 4. Insert Schema
    await client.query(
      `INSERT INTO public.seo_post_schema (
        post_id, article_type, headline_override, description_override,
        faq_enabled, howto_enabled, custom_jsonld, custom_mode, disable_auto
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        post.id,
        input.articleType || 'BlogPosting',
        input.headlineOverride || null,
        input.descriptionOverride || null,
        input.faqEnabled || false,
        input.howtoEnabled || false,
        input.customJsonld ? JSON.stringify(input.customJsonld) : null,
        input.customMode || 'add',
        input.disableAuto || false,
      ]
    );

    // 5. Insert GEO/AEO
    await client.query(
      `INSERT INTO public.seo_post_geo_aeo (
        post_id, primary_question, related_questions, answer_summary,
        intent, primary_entity, secondary_entities, original_insight,
        insight_note, review_interval_months
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        post.id,
        input.primaryQuestion || null,
        JSON.stringify(input.relatedQuestions || []),
        input.answerSummary || null,
        input.intent || 'informational',
        input.primaryEntity ? JSON.stringify(input.primaryEntity) : null,
        JSON.stringify(input.secondaryEntities || []),
        input.originalInsight || false,
        input.insightNote || null,
        input.reviewIntervalMonths || 12,
      ]
    );

    // 6. Primary author / Authors
    const authorIds = input.authorIds && input.authorIds.length > 0 ? input.authorIds : [];
    // If no authors passed, check if actor has an author profile
    if (authorIds.length === 0) {
      const defaultAuthor = await client.query(
        `SELECT id FROM public.seo_authors WHERE user_id = $1 LIMIT 1`,
        [actorId]
      );
      if (defaultAuthor.rows.length > 0) {
        authorIds.push(defaultAuthor.rows[0].id);
      } else {
        // Fallback to first existing author
        const anyAuthor = await client.query(`SELECT id FROM public.seo_authors LIMIT 1`);
        if (anyAuthor.rows.length > 0) authorIds.push(anyAuthor.rows[0].id);
      }
    }

    for (let i = 0; i < authorIds.length; i++) {
      await client.query(
        `INSERT INTO public.seo_post_authors (post_id, author_id, position, role)
         VALUES ($1, $2, $3, 'author')`,
        [post.id, authorIds[i], i + 1]
      );
    }

    // 7. Categories
    if (input.primaryCategoryId) {
      await client.query(
        `INSERT INTO public.seo_post_categories (post_id, category_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [post.id, input.primaryCategoryId]
      );
    }
    if (input.categoryIds) {
      for (const catId of input.categoryIds) {
        await client.query(
          `INSERT INTO public.seo_post_categories (post_id, category_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [post.id, catId]
        );
      }
    }

    // 8. Tags
    if (input.tagIds) {
      for (const tagId of input.tagIds) {
        await client.query(
          `INSERT INTO public.seo_post_tags (post_id, tag_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [post.id, tagId]
        );
      }
    }

    // 8b. References (GEO G1, G2)
    if (input.references) {
      for (let i = 0; i < input.references.length; i++) {
        const ref = input.references[i];
        await client.query(
          `INSERT INTO public.seo_post_references (post_id, position, title, url, publisher, published_date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [post.id, i + 1, ref.title, ref.url, ref.publisher || null, ref.publishedDate || null]
        );
      }
    }

    // 9. Initial Revision
    const snapshot = {
      title: input.title,
      slug: finalSlug,
      bodyJson: { blocks },
      bodyHtml: html,
      seo: { ...input },
    };
    await client.query(
      `INSERT INTO public.seo_post_revisions (
        post_id, revision_no, action, snapshot, source, created_by
      ) VALUES ($1, 1, 'create_draft', $2, 'user', $3)`,
      [post.id, JSON.stringify(snapshot), actorId]
    );

    // 10. Audit Log
    await logAudit({
      actorId,
      action: 'post.create',
      entityType: 'post',
      entityId: post.id,
      afterState: { id: post.id, title: post.title, slug: finalSlug, status: 'draft' },
    });

    return post;
  });
}

/**
 * Updates a post with optimistic locking and recalculates authoritative analysis (FR-BLG-002, FR-BLG-003, Section 7)
 */
async function updatePostCore(
  id: string,
  actorId: string,
  input: Partial<CreatePostInput>,
  expectedVersion?: number,
  isMinorUpdate: boolean = false
) {
  const current = await getPost(id);
  if (!current) {
    throw new Error('Post not found');
  }

  if (input.canonicalUrl !== undefined) {
    input = { ...input, canonicalUrl: validateCanonicalUrl(input.canonicalUrl) };
  }

  // Optimistic concurrency check (Section 15.1, FR-BLG-002)
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    const error: any = new Error('Concurrency conflict: post was modified by another user or session.');
    error.status = 409;
    error.currentVersion = current.version;
    error.changedFields = [];
    throw error;
  }

  const newVersion = current.version + 1;
  const newTitle = input.title !== undefined ? input.title.trim() : current.title;

  let newSlug = current.slug;
  let slugChanged = false;
  if (input.slug && input.slug !== current.slug) {
    newSlug = await ensureUniqueSlug(input.slug, id);
    slugChanged = true;
  }

  const blocks = input.bodyJson?.blocks || current.body_json?.blocks || [];
  const { html, wordCount, readingTimeMin } = renderBlocksToHtml(blocks);

  // Fallbacks
  const effectiveTitle = input.seoTitleRaw !== undefined ? (input.seoTitleRaw || `${newTitle} - Migration Factor`) : (current.seo?.seo_title_raw || `${newTitle} - Migration Factor`);
  const effectiveDesc = input.metaDescriptionRaw !== undefined ? (input.metaDescriptionRaw || input.excerpt || '') : (current.seo?.meta_description_raw || current.excerpt || '');

  return await withTransaction(async (client) => {
    // Check if slug changed on a published post: auto-create 301 redirect (FR-TEC-010)
    if (slugChanged && current.status === 'published') {
      const oldPath = `/blog/${current.slug}`;
      const newPath = `/blog/${newSlug}`;
      // A live URL can never be a redirect source (prevents loops, e.g. C -> A after A -> B -> C)
      await client.query(`DELETE FROM public.seo_redirects WHERE rtrim(source_path, '/') = $1`, [newPath]);
      // Flatten chains: earlier redirects that pointed at the old URL now point straight at the new one
      await client.query(
        `UPDATE public.seo_redirects SET target_url = $2 WHERE rtrim(target_url, '/') = $1 AND active = true`,
        [oldPath, newPath]
      );
      await client.query(
        `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
         VALUES ($1, $2, 301, $3, 'Automatic redirect created on slug change')
         ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url, http_code = 301`,
        [oldPath, newPath, actorId]
      );
      await logAudit({
        actorId,
        action: 'redirect.create',
        entityType: 'redirect',
        afterState: { source: oldPath, target: newPath, httpCode: 301 },
      });
    }

    // 1. Update Post
    const updatePostSql = `
      UPDATE public.seo_posts SET
        title = $1,
        slug = $2,
        body_json = $3,
        body_html = $4,
        excerpt = $5,
        featured_media_id = $6,
        featured_alt_override = $7,
        featured_caption_override = $8,
        primary_category_id = $9,
        template = $10,
        word_count = $11,
        reading_time_min = $12,
        version = $13,
        modified_at = CASE WHEN $14 = true THEN modified_at ELSE now() END,
        updated_at = now()
      WHERE id = $15
      RETURNING *
    `;

    const updatedPostRes = await client.query(updatePostSql, [
      newTitle,
      newSlug,
      JSON.stringify({ blocks }),
      html,
      input.excerpt !== undefined ? input.excerpt : current.excerpt,
      input.featuredMediaId !== undefined ? input.featuredMediaId : current.featured_media_id,
      input.featuredAltOverride !== undefined ? input.featuredAltOverride : current.featured_alt_override,
      input.featuredCaptionOverride !== undefined ? input.featuredCaptionOverride : current.featured_caption_override,
      input.primaryCategoryId !== undefined ? input.primaryCategoryId : current.primary_category_id,
      input.template !== undefined ? input.template : current.template,
      wordCount,
      readingTimeMin,
      newVersion,
      isMinorUpdate,
      id,
    ]);
    const updatedPost = updatedPostRes.rows[0];

    // 2. Update SEO
    if ([input.focusKeyword, input.additionalKeywords, input.seoTitleRaw, input.metaDescriptionRaw, input.canonicalUrl, input.robotsIndex, input.robotsFollow, input.robotsAdvanced, input.breadcrumbTitle, input.customH1, input.sitemapInclude, input.isCornerstone].some((v) => v !== undefined)) {
      await client.query(
        `UPDATE public.seo_post_seo SET
          focus_keyword = $1,
          additional_keywords = COALESCE($2, additional_keywords),
          seo_title_raw = $3,
          seo_title_effective = $4,
          meta_description_raw = $5,
          meta_description_effective = $6,
          canonical_url = $7,
          robots_index = COALESCE($8, robots_index),
          robots_follow = COALESCE($9, robots_follow),
          robots_advanced = COALESCE($10, robots_advanced),
          breadcrumb_title = $11,
          custom_h1 = $12,
          sitemap_include = COALESCE($13, sitemap_include),
          is_cornerstone = COALESCE($14, is_cornerstone)
        WHERE post_id = $15`,
        [
          input.focusKeyword !== undefined ? (input.focusKeyword?.trim() || null) : current.seo?.focus_keyword ?? null,
          input.additionalKeywords ? JSON.stringify(input.additionalKeywords) : null,
          input.seoTitleRaw !== undefined ? input.seoTitleRaw : current.seo?.seo_title_raw,
          effectiveTitle,
          input.metaDescriptionRaw !== undefined ? input.metaDescriptionRaw : current.seo?.meta_description_raw,
          effectiveDesc,
          input.canonicalUrl !== undefined ? input.canonicalUrl : current.seo?.canonical_url,
          input.robotsIndex !== undefined ? input.robotsIndex : null,
          input.robotsFollow !== undefined ? input.robotsFollow : null,
          input.robotsAdvanced ? JSON.stringify(input.robotsAdvanced) : null,
          input.breadcrumbTitle !== undefined ? input.breadcrumbTitle : current.seo?.breadcrumb_title,
          input.customH1 !== undefined ? input.customH1 : current.seo?.custom_h1,
          input.sitemapInclude !== undefined ? input.sitemapInclude : null,
          input.isCornerstone !== undefined ? input.isCornerstone : null,
          id,
        ]
      );
    }

    // 3. Update Social
    if (input.ogTitle !== undefined || input.twitterTitle !== undefined || input.useSeoValues !== undefined) {
      await client.query(
        `UPDATE public.seo_post_social SET
          use_seo_values = COALESCE($1, use_seo_values),
          og_title = $2,
          og_description = $3,
          og_image_media_id = $4,
          twitter_card = COALESCE($5, twitter_card),
          twitter_title = $6,
          twitter_description = $7,
          twitter_image_media_id = $8
        WHERE post_id = $9`,
        [
          input.useSeoValues !== undefined ? input.useSeoValues : null,
          input.ogTitle !== undefined ? input.ogTitle : current.social?.og_title,
          input.ogDescription !== undefined ? input.ogDescription : current.social?.og_description,
          input.ogImageMediaId !== undefined ? input.ogImageMediaId : current.social?.og_image_media_id,
          input.twitterCard !== undefined ? input.twitterCard : null,
          input.twitterTitle !== undefined ? input.twitterTitle : current.social?.twitter_title,
          input.twitterDescription !== undefined ? input.twitterDescription : current.social?.twitter_description,
          input.twitterImageMediaId !== undefined ? input.twitterImageMediaId : current.social?.twitter_image_media_id,
          id,
        ]
      );
    }

    // 4. Update Schema
    if (input.articleType !== undefined || input.customJsonld !== undefined || input.faqEnabled !== undefined) {
      await client.query(
        `UPDATE public.seo_post_schema SET
          article_type = COALESCE($1, article_type),
          headline_override = $2,
          description_override = $3,
          faq_enabled = COALESCE($4, faq_enabled),
          howto_enabled = COALESCE($5, howto_enabled),
          custom_jsonld = $6,
          custom_mode = COALESCE($7, custom_mode),
          disable_auto = COALESCE($8, disable_auto)
        WHERE post_id = $9`,
        [
          input.articleType !== undefined ? input.articleType : null,
          input.headlineOverride !== undefined ? input.headlineOverride : current.schema?.headline_override,
          input.descriptionOverride !== undefined ? input.descriptionOverride : current.schema?.description_override,
          input.faqEnabled !== undefined ? input.faqEnabled : null,
          input.howtoEnabled !== undefined ? input.howtoEnabled : null,
          input.customJsonld !== undefined ? (input.customJsonld ? JSON.stringify(input.customJsonld) : null) : (current.schema?.custom_jsonld ? JSON.stringify(current.schema.custom_jsonld) : null),
          input.customMode !== undefined ? input.customMode : null,
          input.disableAuto !== undefined ? input.disableAuto : null,
          id,
        ]
      );
    }

    // 5. Update GEO / AEO
    if (input.reviewedBy !== undefined) {
      await client.query(
        `UPDATE public.seo_post_geo_aeo SET reviewed_by = $1, reviewed_at = CASE WHEN $1::uuid IS NULL THEN NULL ELSE now() END WHERE post_id = $2`,
        [input.reviewedBy || null, id]
      );
    }
    if (input.primaryQuestion !== undefined || input.answerSummary !== undefined || input.primaryEntity !== undefined) {
      await client.query(
        `UPDATE public.seo_post_geo_aeo SET
          primary_question = $1,
          related_questions = COALESCE($2, related_questions),
          answer_summary = $3,
          intent = COALESCE($4, intent),
          primary_entity = $5,
          secondary_entities = COALESCE($6, secondary_entities),
          original_insight = COALESCE($7, original_insight),
          insight_note = $8,
          review_interval_months = COALESCE($9, review_interval_months)
        WHERE post_id = $10`,
        [
          input.primaryQuestion !== undefined ? input.primaryQuestion : current.geo_aeo?.primary_question,
          input.relatedQuestions ? JSON.stringify(input.relatedQuestions) : null,
          input.answerSummary !== undefined ? input.answerSummary : current.geo_aeo?.answer_summary,
          input.intent !== undefined ? input.intent : null,
          input.primaryEntity !== undefined ? (input.primaryEntity ? JSON.stringify(input.primaryEntity) : null) : (current.geo_aeo?.primary_entity ? JSON.stringify(current.geo_aeo.primary_entity) : null),
          input.secondaryEntities ? JSON.stringify(input.secondaryEntities) : null,
          input.originalInsight !== undefined ? input.originalInsight : null,
          input.insightNote !== undefined ? input.insightNote : current.geo_aeo?.insight_note,
          input.reviewIntervalMonths !== undefined ? input.reviewIntervalMonths : null,
          id,
        ]
      );
    }

    // 6. Update Categories & Tags if provided
    if (input.categoryIds) {
      await client.query(`DELETE FROM public.seo_post_categories WHERE post_id = $1`, [id]);
      for (const catId of input.categoryIds) {
        await client.query(
          `INSERT INTO public.seo_post_categories (post_id, category_id) VALUES ($1, $2)`,
          [id, catId]
        );
      }
    }
    if (input.tagIds) {
      await client.query(`DELETE FROM public.seo_post_tags WHERE post_id = $1`, [id]);
      for (const tagId of input.tagIds) {
        await client.query(
          `INSERT INTO public.seo_post_tags (post_id, tag_id) VALUES ($1, $2)`,
          [id, tagId]
        );
      }
    }
    if (input.authorIds) {
      await client.query(`DELETE FROM public.seo_post_authors WHERE post_id = $1`, [id]);
      for (let i = 0; i < input.authorIds.length; i++) {
        await client.query(
          `INSERT INTO public.seo_post_authors (post_id, author_id, position, role) VALUES ($1, $2, $3, 'author')`,
          [id, input.authorIds[i], i + 1]
        );
      }
    }
    if (input.references) {
      await client.query(`DELETE FROM public.seo_post_references WHERE post_id = $1`, [id]);
      for (let i = 0; i < input.references.length; i++) {
        const ref = input.references[i];
        await client.query(
          `INSERT INTO public.seo_post_references (post_id, position, title, url, publisher, published_date)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, i + 1, ref.title, ref.url, ref.publisher || null, ref.publishedDate || null]
        );
      }
    }

    // 7. Calculate Authoritative Analysis Scores (Section 7)
    const analysisPayload = {
      title: newTitle,
      h1: input.customH1 || current.seo?.custom_h1 || newTitle,
      seoTitle: effectiveTitle,
      metaDescription: effectiveDesc,
      slug: newSlug,
      bodyHtml: html,
      focusKeyword: input.focusKeyword !== undefined ? input.focusKeyword : current.seo?.focus_keyword,
      additionalKeywords: input.additionalKeywords || current.seo?.additional_keywords || [],
      canonicalUrl: input.canonicalUrl !== undefined ? input.canonicalUrl : current.seo?.canonical_url,
      robotsIndex: input.robotsIndex !== undefined ? input.robotsIndex : current.seo?.robots_index,
      robotsFollow: input.robotsFollow !== undefined ? input.robotsFollow : current.seo?.robots_follow,
      sitemapInclude: input.sitemapInclude !== undefined ? input.sitemapInclude : current.seo?.sitemap_include,
      hasFeaturedImage: Boolean(input.featuredMediaId || current.featured_media_id),
      featuredImageAlt: input.featuredAltOverride || current.featured_alt_override || '',
      categoryAssigned: Boolean(input.primaryCategoryId || current.primary_category_id),
      authorAssigned: Boolean(input.authorIds?.length || current.authors?.length),
      primaryQuestion: input.primaryQuestion || current.geo_aeo?.primary_question,
      answerSummary: input.answerSummary || current.geo_aeo?.answer_summary,
      references: input.references || current.references || [],
    };

    const analysisResult = runContentAnalysis(analysisPayload);

    await client.query(
      `INSERT INTO public.seo_analysis (
        post_id, config_version, overall, basic, additional, readability, technical,
        geo, aeo, checks, analyzed_at
      ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, now())
      ON CONFLICT (post_id) DO UPDATE SET
        overall = EXCLUDED.overall,
        basic = EXCLUDED.basic,
        additional = EXCLUDED.additional,
        readability = EXCLUDED.readability,
        technical = EXCLUDED.technical,
        geo = EXCLUDED.geo,
        aeo = EXCLUDED.aeo,
        checks = EXCLUDED.checks,
        analyzed_at = now()`,
      [
        id,
        analysisResult.overallScore,
        analysisResult.basicScore,
        analysisResult.additionalScore,
        analysisResult.readabilityScore,
        analysisResult.technicalScore,
        analysisResult.geoScore,
        analysisResult.aeoScore,
        JSON.stringify(analysisResult.checks),
      ]
    );

    // 8. Revisions: create revision record
    const revisionCountRes = await client.query(
      `SELECT COALESCE(max(revision_no), 0) + 1 as next_rev FROM public.seo_post_revisions WHERE post_id = $1`,
      [id]
    );
    const nextRev = revisionCountRes.rows[0].next_rev;

    await client.query(
      `INSERT INTO public.seo_post_revisions (
        post_id, revision_no, action, snapshot, scores, source, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'user', $6)`,
      [
        id,
        nextRev,
        isMinorUpdate ? 'minor_update' : 'update',
        JSON.stringify(await buildSnapshot(client, id, updatedPost)),
        JSON.stringify({ overall: analysisResult.overallScore, geo: analysisResult.geoScore, aeo: analysisResult.aeoScore }),
        actorId,
      ]
    );

    // 9. Remove user autosave if any
    await client.query(`DELETE FROM public.seo_post_autosaves WHERE post_id = $1 AND user_id = $2`, [id, actorId]);

    // 10. Audit log
    await logAudit({
      actorId,
      action: isMinorUpdate ? 'post.update_minor' : 'post.update',
      entityType: 'post',
      entityId: id,
      beforeState: { title: current.title, slug: current.slug, version: current.version },
      afterState: { title: newTitle, slug: newSlug, version: newVersion },
    });

    return {
      post: updatedPost,
      version: newVersion,
      scores: {
        overall: analysisResult.overallScore,
        basic: analysisResult.basicScore,
        additional: analysisResult.additionalScore,
        readability: analysisResult.readabilityScore,
        technical: analysisResult.technicalScore,
        geo: analysisResult.geoScore,
        aeo: analysisResult.aeoScore,
      },
      checks: analysisResult.checks,
    };
  });
}

/**
 * Full post snapshot (FR-BLG-011): content, SEO, social, schema, GEO/AEO and taxonomy,
 * read inside the same transaction so a restore can rebuild the exact saved state.
 */
async function buildSnapshot(client: any, postId: string, postRow: any) {
  const one = async (table: string) =>
    (await client.query(`SELECT * FROM public.${table} WHERE post_id = $1`, [postId])).rows[0] || null;
  const ids = async (sql: string) => (await client.query(sql, [postId])).rows.map((r: any) => r.id);
  return {
    post: {
      title: postRow.title, slug: postRow.slug, excerpt: postRow.excerpt, body_json: postRow.body_json,
      featured_media_id: postRow.featured_media_id, featured_alt_override: postRow.featured_alt_override,
      featured_caption_override: postRow.featured_caption_override, primary_category_id: postRow.primary_category_id,
      template: postRow.template,
    },
    seo: await one('seo_post_seo'),
    social: await one('seo_post_social'),
    schema: await one('seo_post_schema'),
    geo_aeo: await one('seo_post_geo_aeo'),
    category_ids: await ids('SELECT category_id AS id FROM public.seo_post_categories WHERE post_id = $1'),
    tag_ids: await ids('SELECT tag_id AS id FROM public.seo_post_tags WHERE post_id = $1'),
    author_ids: await ids('SELECT author_id AS id FROM public.seo_post_authors WHERE post_id = $1 ORDER BY position'),
  };
}

/**
 * Pre-publish checks evaluator (Section 17.3)
 */
export async function runPrepublishChecks(post: any): Promise<{
  blocking: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  canPublishWithAck: boolean;
}> {
  const blocking: Array<{ code: string; message: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];

  // 1. Title / H1
  if (!post.title || post.title.trim().length === 0) {
    blocking.push({ code: 'title_empty', message: 'Post title (or custom H1) cannot be empty.' });
  }

  // 2. Body
  const blocks = post.body_json?.blocks || [];
  if (!blocks || blocks.length === 0) {
    blocking.push({ code: 'body_empty', message: 'The article must contain at least one content block.' });
  }

  // 3. Slug
  if (!post.slug || post.slug.trim().length === 0) {
    blocking.push({ code: 'slug_empty', message: 'Slug cannot be empty.' });
  }

  // 4. Empty headings
  for (const block of blocks) {
    if (block.type === 'heading' && (!block.data?.text || block.data.text.trim().length === 0)) {
      blocking.push({ code: 'empty_heading', message: 'Heading blocks cannot be empty.' });
      break;
    }
  }

  // 5. Featured image
  const settings = await getSeoSettings();
  if (!post.featured_media_id) {
    if (settings.requireFeaturedImage) {
      blocking.push({ code: 'featured_image_missing', message: 'Featured image is required before publishing.' });
    }
  } else {
    if ((post.featured_media_width || 0) < MIN_FEATURED_WIDTH) {
      blocking.push({ code: 'featured_image_small', message: `The featured image is ${post.featured_media_width || 'unknown'} px wide. Use an image at least ${MIN_FEATURED_WIDTH} px wide.` });
    }
    if (!((post.featured_alt_override || post.featured_media_alt || '') as string).trim()) {
      blocking.push({ code: 'featured_image_alt_missing', message: 'The featured image needs alt text.' });
    }
  }

  // 6. Authors
  if (!post.authors || post.authors.length === 0) {
    blocking.push({ code: 'author_missing', message: 'At least one author must be assigned.' });
  }

  // 7. Image alt text, FAQ and Steps blocks (Section 17.3)
  for (const block of blocks) {
    if (block.type === 'image' && !block.data?.isDecorative && !(block.data?.alt || '').trim()) {
      blocking.push({ code: 'image_alt_missing', message: 'Every non-decorative image needs alt text (or mark it decorative).' });
      break;
    }
  }
  for (const block of blocks) {
    if (block.type === 'faq') {
      const items = Array.isArray(block.data?.items) ? block.data.items : [];
      if (items.some((i: any) => !(i?.question || '').trim() || !(i?.answer || '').trim())) {
        blocking.push({ code: 'faq_empty_item', message: 'FAQ items cannot have an empty question or answer.' });
        break;
      }
    }
  }
  for (const block of blocks) {
    if (block.type === 'steps') {
      const steps = Array.isArray(block.data?.steps) ? block.data.steps : [];
      if (steps.some((st: any) => !(st?.text || '').trim())) {
        blocking.push({ code: 'steps_empty_item', message: 'Steps cannot have an empty description.' });
        break;
      }
    }
  }

  // 8. Canonical URL (FR-SEO-006): valid absolute URL; same-site target must be a live, indexable post
  const canonical = post.seo?.canonical_url as string | null | undefined;
  if (canonical && canonical.trim()) {
    try {
      const normalized = validateCanonicalUrl(canonical);
      const url = new URL(normalized as string);
      const siteHost = new URL(SITE_URL).host;
      if (url.host === siteHost) {
        const m = url.pathname.match(/^\/blog\/([^/]+)\/?$/);
        if (m && m[1] !== post.slug) {
          const target = await queryOne<{ status: string; robots_index: boolean }>(
            `SELECT p.status, s.robots_index FROM public.seo_posts p
             LEFT JOIN public.seo_post_seo s ON s.post_id = p.id WHERE p.slug = $1`,
            [m[1]]
          );
          if (!target || target.status !== 'published' || target.robots_index === false) {
            blocking.push({ code: 'canonical_target_invalid', message: 'The canonical URL points to a page that is not published and indexable. Choose an indexable page.' });
          } else {
            warnings.push({ code: 'canonical_elsewhere', message: 'This post asks search engines to index another URL instead of this one.' });
          }
        }
      } else {
        warnings.push({ code: 'canonical_cross_domain', message: 'Canonical points to another domain; this page will not be indexed.' });
      }
    } catch (e: any) {
      blocking.push({ code: 'canonical_invalid', message: e.message });
    }
  }

  // 9. Duplicate metadata (FR-SEO-013)
  const effTitle = post.seo?.seo_title_effective as string | undefined;
  if (effTitle) {
    const dup = await queryOne<{ title: string }>(
      `SELECT p.title FROM public.seo_posts p JOIN public.seo_post_seo s ON s.post_id = p.id
       WHERE p.id <> $1 AND p.status IN ('published','scheduled') AND lower(trim(s.seo_title_effective)) = lower(trim($2)) LIMIT 1`,
      [post.id, effTitle]
    );
    if (dup) warnings.push({ code: 'seo_title_duplicate', message: `SEO title is identical to '${dup.title}'.` });
  }
  const effDesc = (post.seo?.meta_description_raw as string | undefined)?.trim();
  if (effDesc) {
    const dup = await queryOne<{ title: string }>(
      `SELECT p.title FROM public.seo_posts p JOIN public.seo_post_seo s ON s.post_id = p.id
       WHERE p.id <> $1 AND p.status IN ('published','scheduled') AND lower(trim(s.meta_description_raw)) = lower($2) LIMIT 1`,
      [post.id, effDesc.toLowerCase()]
    );
    if (dup) warnings.push({ code: 'meta_description_duplicate', message: `Meta description is identical to '${dup.title}'.` });
  }
  if (post.seo?.focus_keyword) {
    const dup = await queryOne<{ title: string }>(
      `SELECT p.title FROM public.seo_posts p JOIN public.seo_post_seo s ON s.post_id = p.id
       WHERE p.id <> $1 AND p.status = 'published' AND lower(trim(s.focus_keyword)) = lower(trim($2)) LIMIT 1`,
      [post.id, post.seo.focus_keyword]
    );
    if (dup) warnings.push({ code: 'focus_keyword_duplicate', message: `Focus keyword is already used by '${dup.title}' (possible cannibalization).` });
  }
  if (post.seo?.robots_follow === false) {
    warnings.push({ code: 'nofollow_warning', message: 'Links on this post will not be followed by search engines.' });
  }

  // 10. Structured data (FR-SCH-005): errors block publishing, warnings are shown
  try {
    const settings2 = await getSeoSettings();
    const rendered = renderSeoHead({
      siteUrl: SITE_URL, siteName: settings2.siteName, settings: settings2, post,
      seo: post.seo, social: post.social, schemaConfig: post.schema, geoAeo: post.geo_aeo,
      featuredMedia: post.featured_media_url
        ? { url: post.featured_media_url, alt: post.featured_alt_override || post.featured_media_alt, width: post.featured_media_width, height: post.featured_media_height }
        : undefined,
      category: post.categories?.[0], authors: post.authors,
    });
    if (rendered.schemaGraph) {
      const v = validateSchemaGraph(rendered.schemaGraph);
      for (const m of v.errors) blocking.push({ code: 'schema_error', message: m });
      for (const m of v.warnings) warnings.push({ code: 'schema_warning', message: m });
    }
  } catch (e: any) {
    blocking.push({ code: 'schema_error', message: 'Structured data could not be generated: ' + e.message });
  }

  // Warnings
  const analysis = post.analysis || {};
  if (analysis.overall !== undefined && analysis.overall < 50) {
    warnings.push({ code: 'seo_score_low', message: `SEO score is ${analysis.overall} (Poor). Review the checklist.` });
  }

  if (!post.seo?.focus_keyword || post.seo.focus_keyword.trim().length === 0) {
    warnings.push({ code: 'focus_keyword_missing', message: 'No focus keyword set.' });
  }

  if (!post.seo?.meta_description_raw || post.seo.meta_description_raw.trim().length === 0) {
    warnings.push({ code: 'meta_description_missing', message: 'Meta description is empty (Google will generate a snippet).' });
  }

  if (post.seo?.robots_index === false) {
    warnings.push({ code: 'noindex_warning', message: 'This post is set to noindex and will not be indexed by search engines.' });
  }

  if (analysis.readability !== undefined && analysis.readability < 50) {
    warnings.push({ code: 'readability_low', message: `Readability score is ${analysis.readability}. Consider shorter sentences.` });
  }

  return {
    blocking,
    warnings,
    canPublishWithAck: blocking.length === 0,
  };
}

/**
 * Publish post immediately (FR-BLG-005, Section 17)
 */
async function publishPostCore(id: string, actorId: string, acknowledgeWarnings: boolean = false) {
  const post = await getPost(id);
  if (!post) throw new Error('Post not found');

  const checkResults = await runPrepublishChecks(post);

  if (checkResults.blocking.length > 0) {
    const error: any = new Error('Pre-publish checks failed with blocking errors.');
    error.status = 422;
    error.blocking = checkResults.blocking;
    error.warnings = checkResults.warnings;
    throw error;
  }

  if (checkResults.warnings.length > 0 && !acknowledgeWarnings) {
    const error: any = new Error('Pre-publish checks have warnings that need acknowledgment.');
    error.status = 409;
    error.blocking = [];
    error.warnings = checkResults.warnings;
    error.canPublishWithAck = true;
    throw error;
  }

  return await withTransaction(async (client) => {
    const now = new Date();
    const publishedAt = post.published_at || now;

    // 1. Set status published
    await client.query(
      `UPDATE public.seo_posts SET
        status = 'published',
        published_at = $1,
        modified_at = $2,
        updated_at = $2,
        version = version + 1
       WHERE id = $3`,
      [publishedAt, now, id]
    );

    // 2. Revision
    const revisionCountRes = await client.query(
      `SELECT COALESCE(max(revision_no), 0) + 1 as next_rev FROM public.seo_post_revisions WHERE post_id = $1`,
      [id]
    );
    const nextRev = revisionCountRes.rows[0].next_rev;

    await client.query(
      `INSERT INTO public.seo_post_revisions (
        post_id, revision_no, action, snapshot, source, created_by
      ) VALUES ($1, $2, 'publish', $3, 'user', $4)`,
      [
        id,
        nextRev,
        JSON.stringify({ title: post.title, slug: post.slug, status: 'published', published_at: publishedAt }),
        actorId,
      ]
    );

    // 3. Queue Outbox job: post.published (NFR-REL-01, FR-IDX)
    await client.query(
      `INSERT INTO public.seo_scheduled_jobs (event_type, aggregate_id, payload, available_at)
       VALUES ('post.published', $1, $2, now())`,
      [id, JSON.stringify({ postId: id, slug: post.slug, url: `https://migrationfactor.com/blog/${post.slug}` })]
    );

    // 4. Audit Log
    await logAudit({
      actorId,
      action: 'post.publish',
      entityType: 'post',
      entityId: id,
      beforeState: { status: post.status },
      afterState: { status: 'published', published_at: publishedAt },
    });

    return {
      success: true,
      publishedAt,
      url: `/blog/${post.slug}`,
    };
  });
}

/**
 * Schedule publication (FR-BLG-006)
 */
export async function schedulePost(id: string, actorId: string, publishAtIso: string) {
  const publishAt = new Date(publishAtIso);
  const now = new Date();
  if (publishAt.getTime() <= now.getTime() + 60 * 1000) {
    throw new Error('Scheduled date must be in the future (at least 2 minutes ahead).');
  }

  const post = await getPost(id);
  if (!post) throw new Error('Post not found');

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE public.seo_posts SET
        status = 'scheduled',
        scheduled_at = $1,
        updated_at = now(),
        version = version + 1
       WHERE id = $2`,
      [publishAt, id]
    );

    await client.query(
      `INSERT INTO public.seo_scheduled_jobs (event_type, aggregate_id, payload, available_at)
       VALUES ('post.scheduled_publish', $1, $2, $3)`,
      [id, JSON.stringify({ postId: id }), publishAt]
    );

    await logAudit({
      actorId,
      action: 'post.schedule',
      entityType: 'post',
      entityId: id,
      afterState: { status: 'scheduled', scheduled_at: publishAt },
    });

    return { success: true, scheduledAt: publishAt };
  });
}

/**
 * Unpublish post with 404, 410 or 301 behavior (FR-BLG-007)
 */
/** FR-BLG-007: a 301 target must be a different, live page (no self-redirect, no loop, no chain). */
async function assertRedirectTarget(slug: string, target: string) {
  let path: string;
  try {
    const u = new URL(target, SITE_URL);
    if (u.host.replace(/^www\./, '') !== new URL(SITE_URL).host.replace(/^www\./, '')) return; // external targets are allowed
    path = u.pathname.toLowerCase().replace(/\/+$/, '');
  } catch {
    throw new Error('The redirect target is not a valid URL.');
  }
  if (path === `/blog/${slug}`) throw new Error('A post cannot redirect to itself.');
  const m = /^\/blog\/([^/]+)$/.exec(path) || /^\/([^/]+)$/.exec(path);
  if (m) {
    const t = await queryOne<{ status: string }>(`SELECT status FROM public.seo_posts WHERE slug = $1 OR legacy_path = $2`, [m[1], path + '/']);
    if (!t) return;
    if (t.status !== 'published') throw new Error('The redirect target must be a published page.');
  }
  const chain = await queryOne(`SELECT 1 FROM public.seo_redirects WHERE active = true AND rtrim(source_path, '/') = $1`, [path]);
  if (chain) throw new Error('The redirect target itself redirects. Point to the final URL to avoid a redirect chain.');
}

export async function unpublishPost(
  id: string,
  actorId: string,
  behavior: '404' | '410' | '301' = '404',
  redirectTarget?: string
) {
  const post = await getPost(id);
  if (!post) throw new Error('Post not found');

  if (behavior === '301') {
    if (!redirectTarget || redirectTarget.trim().length === 0) {
      throw new Error('Redirect target is required when choosing a 301 redirect.');
    }
  }
  if (behavior === '301' && redirectTarget) await assertRedirectTarget(post.slug, redirectTarget);

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE public.seo_posts SET
        status = 'unpublished',
        unpublish_behavior = $1,
        updated_at = now(),
        version = version + 1
       WHERE id = $2`,
      [behavior, id]
    );

    if (behavior === '301' && redirectTarget) {
      await client.query(
        `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
         VALUES ($1, $2, 301, $3, 'Created upon unpublishing post')
         ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
        [`/blog/${post.slug}`, redirectTarget, actorId]
      );
    }

    await logAudit({
      actorId,
      action: 'post.unpublish',
      entityType: 'post',
      entityId: id,
      afterState: { status: 'unpublished', behavior, redirectTarget },
    });

    return { success: true };
  });
}

/**
 * Move post to trash (FR-BLG-008)
 */
export async function trashPost(id: string, actorId: string, behavior: '410' | '301' = '410', redirectTarget?: string) {
  const post = await getPost(id);
  if (!post) throw new Error('Post not found');

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE public.seo_posts SET
        prior_status = status,
        status = 'trashed',
        trashed_at = now(),
        trashed_by = $1,
        unpublish_behavior = $2,
        updated_at = now()
       WHERE id = $3`,
      [actorId, behavior, id]
    );

    if (behavior === '301' && redirectTarget) {
      await client.query(
        `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
         VALUES ($1, $2, 301, $3, 'Created upon moving post to trash')
         ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
        [`/blog/${post.slug}`, redirectTarget, actorId]
      );
    }

    await logAudit({
      actorId,
      action: 'post.trash',
      entityType: 'post',
      entityId: id,
      beforeState: { status: post.status },
      afterState: { status: 'trashed' },
    });

    return { success: true };
  });
}

/**
 * Restore post from trash (FR-BLG-008)
 */
export async function restorePost(id: string, actorId: string) {
  const post = await getPost(id);
  if (!post) throw new Error('Post not found');
  if (post.status !== 'trashed') throw new Error('Post is not in trash');

  // If previously published, restore as unpublished so admin republishes intentionally (FR-BLG-001)
  const targetStatus = post.prior_status === 'published' ? 'unpublished' : (post.prior_status || 'draft');

  // Verify slug conflict
  const finalSlug = await ensureUniqueSlug(post.slug, id);

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE public.seo_posts SET
        status = $1,
        slug = $2,
        trashed_at = null,
        trashed_by = null,
        updated_at = now()
       WHERE id = $3`,
      [targetStatus, finalSlug, id]
    );

    await logAudit({
      actorId,
      action: 'post.restore',
      entityType: 'post',
      entityId: id,
      afterState: { status: targetStatus, slug: finalSlug },
    });

    return { success: true, status: targetStatus, slug: finalSlug };
  });
}

/**
 * Duplicate post (FR-BLG-009)
 * Copies content, featured image, categories, tags, schema template.
 * CLEARS focus_keyword, additional_keywords, seo_title_raw, meta_description_raw, canonical_url.
 */
export async function duplicatePost(id: string, actorId: string) {
  const orig = await getPost(id);
  if (!orig) throw new Error('Post not found');

  const duplicateTitle = `Copy of ${orig.title}`;
  const duplicateSlug = await ensureUniqueSlug(`${orig.slug}-copy`);

  return await createDraft(actorId, {
    title: duplicateTitle,
    slug: duplicateSlug,
    bodyJson: orig.body_json,
    excerpt: orig.excerpt,
    featuredMediaId: orig.featured_media_id,
    featuredAltOverride: orig.featured_alt_override,
    featuredCaptionOverride: orig.featured_caption_override,
    primaryCategoryId: orig.primary_category_id,
    categoryIds: orig.categories?.map((c: any) => c.id) || [],
    tagIds: orig.tags?.map((t: any) => t.id) || [],
    authorIds: orig.authors?.map((a: any) => a.id) || [],
    template: orig.template,
    // Clear SEO metadata to avoid duplicates and cannibalization (FR-BLG-009)
    focusKeyword: null,
    additionalKeywords: [],
    seoTitleRaw: null,
    metaDescriptionRaw: null,
    canonicalUrl: null,
    robotsIndex: true,
    robotsFollow: true,
    // Copy schema
    articleType: orig.schema?.article_type,
    faqEnabled: orig.schema?.faq_enabled,
    howtoEnabled: orig.schema?.howto_enabled,
  });
}

/**
 * Permanent Delete (FR-BLG-008)
 * Creates tombstone so URL keeps returning 410 and slug is not reused silently.
 */
export async function permanentDeletePost(id: string, actorId: string, confirmText: string) {
  const post = await getPost(id);
  if (!post) throw new Error('Post not found');

  if (confirmText !== post.title && confirmText !== 'DELETE') {
    throw new Error('Type DELETE or the exact post title to confirm permanent deletion.');
  }

  return await withTransaction(async (client) => {
    // 1. Create tombstone
    await client.query(
      `INSERT INTO public.seo_url_tombstones (path, former_post_id, http_code)
       VALUES ($1, $2, 410)
       ON CONFLICT (path) DO NOTHING`,
      [`/blog/${post.slug}`, id]
    );

    // 2. Delete post row (cascades to child tables)
    await client.query(`DELETE FROM public.seo_posts WHERE id = $1`, [id]);

    // 3. Audit log
    await logAudit({
      actorId,
      action: 'post.delete_permanent',
      entityType: 'post',
      entityId: id,
      beforeState: { title: post.title, slug: post.slug },
    });

    return { success: true };
  });
}


/** Custom JSON-LD must be valid before it is saved (FR-SCH-004). */
function assertCustomSchema(input: Partial<CreatePostInput>) {
  if (input.customJsonld === undefined || input.customJsonld === null || input.customJsonld === '') return;
  const text = typeof input.customJsonld === 'string' ? input.customJsonld : JSON.stringify(input.customJsonld);
  const res = validateCustomJsonLd(text);
  if (res.errors.length) {
    const err: any = new Error(res.errors.join(' '));
    err.status = 422;
    throw err;
  }
  if (typeof input.customJsonld === 'string') input.customJsonld = res.value;
}

/** noindex posts are never listed in the sitemap (auto-fixed, Section 17.3 "Robots conflicts"). */
function resolveRobotsConflict<T extends Partial<CreatePostInput>>(input: T): T {
  return input.robotsIndex === false ? { ...input, sitemapInclude: false } : input;
}

export async function createDraft(actorId: string, input: CreatePostInput) {
  assertCustomSchema(input);
  const result: any = await createDraftCore(actorId, resolveRobotsConflict(input));
  const id = result?.id ?? result?.post?.id;
  if (id) await reindexPostLinks(id).catch(() => undefined);
  return result;
}

export async function updatePost(
  id: string,
  actorId: string,
  input: Partial<CreatePostInput>,
  expectedVersion?: number,
  isMinorUpdate: boolean = false
) {
  assertCustomSchema(input);
  const result = await updatePostCore(id, actorId, resolveRobotsConflict(input), expectedVersion, isMinorUpdate);
  await reindexPostLinks(id).catch(() => undefined);
  return result;
}

export async function publishPost(id: string, actorId: string, acknowledgeWarnings: boolean = false) {
  const result = await publishPostCore(id, actorId, acknowledgeWarnings);
  await reindexPostLinks(id).catch(() => undefined);
  return result;
}
