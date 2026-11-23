import { query, queryOne } from './db';

export async function getSeoDashboardData() {
  // 1. Content Status Counts
  const statusRes = await query<{ status: string; count: string }>(
    `SELECT status, count(*) as count FROM public.seo_posts GROUP BY status`
  );

  const statusCounts: Record<string, number> = {
    published: 0,
    draft: 0,
    pending_review: 0,
    scheduled: 0,
    unpublished: 0,
    trashed: 0,
    total: 0,
  };

  for (const r of statusRes) {
    const c = parseInt(r.count, 10);
    if (r.status !== 'trashed') statusCounts.total += c;
    if (statusCounts[r.status] !== undefined) statusCounts[r.status] = c;
  }

  // 2. Score Distributions and Averages
  const scoreStats = await queryOne<any>(
    `SELECT 
      round(avg(overall)) as avg_seo,
      round(avg(readability)) as avg_readability,
      round(avg(geo)) as avg_geo,
      round(avg(aeo)) as avg_aeo,
      count(*) FILTER (WHERE overall >= 80) as band_high,
      count(*) FILTER (WHERE overall >= 60 AND overall < 80) as band_med,
      count(*) FILTER (WHERE overall < 60) as band_low
     FROM public.seo_analysis a
     JOIN public.seo_posts p ON p.id = a.post_id
     WHERE p.status = 'published'`
  );

  // 3. Issues List
  const issues = await queryOne<any>(
    `SELECT 
      count(p.id) FILTER (WHERE s.meta_description_raw IS NULL OR trim(s.meta_description_raw) = '') as missing_meta_desc,
      count(p.id) FILTER (WHERE s.focus_keyword IS NULL OR trim(s.focus_keyword) = '') as missing_focus_kw,
      count(p.id) FILTER (WHERE p.featured_media_id IS NULL) as missing_featured_img,
      count(p.id) FILTER (WHERE s.robots_index = false) as non_indexable,
      count(p.id) FILTER (WHERE a.overall < 60) as low_seo_score
     FROM public.seo_posts p
     LEFT JOIN public.seo_post_seo s ON s.post_id = p.id
     LEFT JOIN public.seo_analysis a ON a.post_id = p.id
     WHERE p.status = 'published'`
  );

  // 4. Orphan posts count
  const orphansRes = await queryOne<{ count: string }>(
    `SELECT count(p.id) as count
     FROM public.seo_posts p
     WHERE p.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM public.seo_links l
         WHERE l.target_post_id = p.id AND l.source_post_id <> p.id
       )`
  );

  // 5. Indexing Submissions Summary
  const indexingRes = await query<{ status: string; count: string }>(
    `SELECT status, count(*) as count FROM public.seo_indexing_submissions GROUP BY status`
  );
  const indexingCounts: Record<string, number> = {
    queued: 0,
    submitted: 0,
    accepted: 0,
    failed: 0,
  };
  for (const r of indexingRes) {
    if (indexingCounts[r.status] !== undefined) indexingCounts[r.status] = parseInt(r.count, 10);
  }

  // 6. Top 404s
  const top404s = await query<any>(
    `SELECT path, sum(hits) as total_hits, max(day) as last_seen
     FROM public.seo_not_found_daily
     WHERE status = 'new'
     GROUP BY path
     ORDER BY total_hits DESC
     LIMIT 5`
  );

  // 7. Recent Audit Activity
  const recentActivity = await query<any>(
    `SELECT l.action, l.entity_type, l.created_at, u.display_name as actor_name
     FROM public.seo_audit_logs l
     LEFT JOIN public.seo_users u ON u.id = l.actor_id
     ORDER BY l.created_at DESC
     LIMIT 8`
  );

  return {
    statusCounts,
    scores: {
      avgSeo: scoreStats?.avg_seo || 0,
      avgReadability: scoreStats?.avg_readability || 0,
      avgGeo: scoreStats?.avg_geo || 0,
      avgAeo: scoreStats?.avg_aeo || 0,
      bandHigh: parseInt(scoreStats?.band_high || '0', 10),
      bandMed: parseInt(scoreStats?.band_med || '0', 10),
      bandLow: parseInt(scoreStats?.band_low || '0', 10),
    },
    issues: {
      missingMetaDesc: parseInt(issues?.missing_meta_desc || '0', 10),
      missingFocusKw: parseInt(issues?.missing_focus_kw || '0', 10),
      missingFeaturedImg: parseInt(issues?.missing_featured_img || '0', 10),
      nonIndexable: parseInt(issues?.non_indexable || '0', 10),
      lowSeoScore: parseInt(issues?.low_seo_score || '0', 10),
      orphanPosts: parseInt(orphansRes?.count || '0', 10),
    },
    indexingCounts,
    top404s,
    recentActivity,
  };
}
