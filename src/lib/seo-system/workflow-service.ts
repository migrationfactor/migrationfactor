import { query, queryOne } from './db';
import { logAudit } from './audit';

/**
 * Author hand-off (FR-BLG-001 transition table): draft -> pending_review.
 */
export async function submitForReview(id: string, actorId: string) {
  const post = await queryOne<{ status: string; title: string }>(`SELECT status, title FROM public.seo_posts WHERE id = $1`, [id]);
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.status !== 'draft') {
    throw Object.assign(new Error(`Only drafts can be submitted for review (current status: ${post.status}).`), { status: 409 });
  }
  await query(`UPDATE public.seo_posts SET status = 'pending_review', updated_at = now(), version = version + 1 WHERE id = $1`, [id]);
  await logAudit({
    actorId, action: 'post.submit_review', entityType: 'post', entityId: id,
    beforeState: { status: 'draft' }, afterState: { status: 'pending_review' },
  });
  return { success: true, status: 'pending_review' };
}

export async function listRevisions(postId: string) {
  return query(
    `SELECT r.id, r.revision_no, r.action, r.scores, r.source, r.created_at, u.name AS created_by_name
     FROM public.seo_post_revisions r
     LEFT JOIN public.seo_users u ON u.id = r.created_by
     WHERE r.post_id = $1 ORDER BY r.revision_no DESC LIMIT 200`,
    [postId]
  );
}

/**
 * Returns a revision plus an editor payload. Restoring only loads values into the editor:
 * it never saves, publishes or changes the slug of a live post (FR-BLG-011).
 */
export async function getRevision(postId: string, revisionNo: number) {
  const rev = await queryOne<any>(
    `SELECT id, revision_no, action, snapshot, scores, created_at FROM public.seo_post_revisions WHERE post_id = $1 AND revision_no = $2`,
    [postId, revisionNo]
  );
  if (!rev) return null;
  const snap = rev.snapshot || {};
  const post = snap.post || {};
  const seo = snap.seo || {};
  const social = snap.social || {};
  const schema = snap.schema || {};
  const geo = snap.geo_aeo || {};
  const editorPayload = snap.post
    ? {
        title: post.title, slug: post.slug, excerpt: post.excerpt, bodyJson: post.body_json,
        featuredMediaId: post.featured_media_id, primaryCategoryId: post.primary_category_id, template: post.template,
        categoryIds: snap.category_ids, tagIds: snap.tag_ids, authorIds: snap.author_ids,
        focusKeyword: seo.focus_keyword, additionalKeywords: seo.additional_keywords,
        seoTitleRaw: seo.seo_title_raw, metaDescriptionRaw: seo.meta_description_raw, canonicalUrl: seo.canonical_url,
        robotsIndex: seo.robots_index, robotsFollow: seo.robots_follow, robotsAdvanced: seo.robots_advanced,
        breadcrumbTitle: seo.breadcrumb_title, customH1: seo.custom_h1, sitemapInclude: seo.sitemap_include,
        ogTitle: social.og_title, ogDescription: social.og_description, twitterTitle: social.twitter_title,
        twitterDescription: social.twitter_description,
        articleType: schema.article_type, faqEnabled: schema.faq_enabled, howtoEnabled: schema.howto_enabled,
        primaryQuestion: geo.primary_question, relatedQuestions: geo.related_questions, answerSummary: geo.answer_summary,
        intent: geo.intent, primaryEntity: geo.primary_entity,
      }
    : null; // legacy partial snapshots cannot be restored
  return { ...rev, restorable: Boolean(editorPayload), editorPayload };
}

export async function saveAutosave(postId: string, userId: string, snapshot: unknown) {
  await query(
    `INSERT INTO public.seo_post_autosaves (post_id, user_id, snapshot, saved_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (post_id, user_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, saved_at = now()`,
    [postId, userId, JSON.stringify(snapshot)]
  );
  return { success: true, savedAt: new Date().toISOString() };
}

export async function getAutosave(postId: string, userId: string) {
  return queryOne(`SELECT snapshot, saved_at FROM public.seo_post_autosaves WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
}

export async function getNotFoundReport(limit = 200) {
  return query(
    `SELECT path, sum(hits)::int AS hits, min(day) AS first_seen, max(day) AS last_seen
     FROM public.seo_not_found_daily WHERE day >= current_date - 90
     GROUP BY path ORDER BY hits DESC LIMIT $1`,
    [limit]
  );
}

/**
 * Internal link reports (FR-LNK-005): orphans, links to unpublished/deleted posts, links to redirected URLs.
 */
export async function getLinkReports() {
  const orphans = await query(
    `SELECT p.id, p.title, p.slug FROM public.seo_posts p
     WHERE p.status = 'published' AND NOT EXISTS (
       SELECT 1 FROM public.seo_links l JOIN public.seo_posts sp ON sp.id = l.source_post_id AND sp.status = 'published'
       WHERE l.target_post_id = p.id AND l.source_post_id <> p.id)
     ORDER BY p.published_at DESC`
  );
  const broken = await query(
    `SELECT l.id, l.source_post_id, sp.title AS source_title, l.target_url, l.anchor_text, tp.status AS target_status
     FROM public.seo_links l
     JOIN public.seo_posts sp ON sp.id = l.source_post_id
     LEFT JOIN public.seo_posts tp ON tp.id = l.target_post_id
     WHERE l.is_internal AND sp.status = 'published'
       AND ((l.target_post_id IS NOT NULL AND tp.status <> 'published') OR l.last_status >= 400)`
  );
  const redirected = await query(
    `SELECT l.id, l.source_post_id, sp.title AS source_title, l.target_url, r.target_url AS final_url
     FROM public.seo_links l
     JOIN public.seo_posts sp ON sp.id = l.source_post_id
     JOIN public.seo_redirects r ON r.active AND r.source_path = regexp_replace(lower(l.target_url_normalized), '^https?://[^/]+', '')
     WHERE l.is_internal AND sp.status = 'published'`
  );
  return { orphans, broken, redirected };
}

export async function listAuditLogs(opts: { entityType?: string; actorId?: string; action?: string; limit?: number; offset?: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.entityType) { params.push(opts.entityType); where.push(`entity_type = $${params.length}`); }
  if (opts.actorId) { params.push(opts.actorId); where.push(`actor_id = $${params.length}`); }
  if (opts.action) { params.push(`%${opts.action}%`); where.push(`action ILIKE $${params.length}`); }
  params.push(Math.min(opts.limit ?? 50, 200), opts.offset ?? 0);
  return query(
    `SELECT * FROM public.seo_audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
}

/**
 * robots.txt tester (FR-TEC-004): longest-match Allow/Disallow evaluation per RFC 9309.
 */
export function testRobotsRule(content: string, urlPath: string, userAgent = '*') {
  const groups: Array<{ agents: string[]; rules: Array<{ type: 'allow' | 'disallow'; path: string }> }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ type: field, path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const ua = userAgent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && ua.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  let best: { type: 'allow' | 'disallow'; path: string } | null = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (!r.path) continue;
      const escaped = r.path.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      const pattern = escaped.endsWith('$') ? escaped.slice(0, -1) + '$' : escaped;
      if (new RegExp('^' + pattern).test(urlPath)) {
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === 'allow')) best = r;
      }
    }
  }
  return {
    allowed: !best || best.type === 'allow',
    matchedRule: best ? `${best.type === 'allow' ? 'Allow' : 'Disallow'}: ${best.path}` : null,
  };
}
