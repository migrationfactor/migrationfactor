import { query, queryOne } from './db';
import { logAudit } from './audit';
import crypto from 'crypto';

export const INDEXNOW_API_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const DEFAULT_HOST = 'migrationfactor.com';

export interface IndexingStatusResult {
  postId: string;
  url: string;
  status: 'draft' | 'submitted' | 'accepted' | 'crawled' | 'indexed' | 'not_indexed' | 'failed';
  channelSubmissions: Array<{
    channel: string;
    action: string;
    status: string;
    requestedAt: string;
    responseExcerpt?: string;
  }>;
  latestInspection?: {
    verdict: string;
    coverageState?: string;
    lastCrawlTime?: string;
    crawledAs?: string;
    pageFetchState?: string;
    robotsTxtState?: string;
    userCanonical?: string;
    googleCanonical?: string;
  };
}

/**
 * Returns or initializes the active IndexNow API key (FR-IDX-005)
 */
export async function getOrCreateIndexNowKey(): Promise<string> {
  const setting = await queryOne<{ value: any }>(
    `SELECT value FROM public.seo_settings WHERE key = 'indexing'`
  );

  if (setting?.value?.indexnow_key) {
    return setting.value.indexnow_key;
  }

  // Generate a random 32-character hexadecimal key
  const newKey = crypto.randomBytes(16).toString('hex');
  const existingVal = setting?.value || {};
  existingVal.indexnow_key = newKey;
  existingVal.indexnow_enabled = existingVal.indexnow_enabled ?? false; // off until an admin enables it (FR-IDX-006)

  await query(
    `INSERT INTO public.seo_settings (key, value)
     VALUES ('indexing', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(existingVal)]
  );

  return newKey;
}

/**
 * Submits URL(s) to IndexNow (FR-IDX-005)
 */
export async function submitToIndexNow(urls: string[], postId?: string, actorId?: string) {
  const key = await getOrCreateIndexNowKey();
  const host = DEFAULT_HOST;

  const payload = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls,
  };

  let responseCode = 200;
  let responseExcerpt = '';
  let status: 'accepted' | 'failed' = 'accepted';

  try {
    const res = await fetch(INDEXNOW_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    responseCode = res.status;
    responseExcerpt = `IndexNow HTTP ${res.status}: ${res.statusText}`;
    if (!res.ok && res.status !== 202) {
      status = 'failed';
    }
  } catch (err: any) {
    // If running in development without internet or mocked
    responseCode = 0;
    status = 'failed';
    responseExcerpt = `IndexNow request failed: ${err?.message || 'network error'}`;
  }

  // Record submission in seo_indexing_submissions
  for (const url of urls) {
    await query(
      `INSERT INTO public.seo_indexing_submissions (
        post_id, url, channel, action, triggered_by, user_id,
        response_code, response_excerpt, status
      ) VALUES ($1, $2, 'indexnow', 'submit', $3, $4, $5, $6, $7)`,
      [
        postId || null,
        url,
        actorId ? 'user' : 'event',
        actorId || null,
        responseCode,
        responseExcerpt,
        status,
      ]
    );
  }

  if (actorId) {
    await logAudit({
      actorId,
      action: 'indexing.indexnow_submit',
      entityType: 'indexing',
      entityId: postId,
      afterState: { urls, responseCode, status },
    });
  }

  return { success: status === 'accepted', responseCode, responseExcerpt };
}

/**
 * Get comprehensive indexing status and history for a post (Section 12, FR-IDX-007)
 */
export async function getPostIndexingStatus(postId: string): Promise<IndexingStatusResult> {
  const post = await queryOne<any>(
    `SELECT p.id, p.slug, p.status FROM public.seo_posts p WHERE p.id = $1`,
    [postId]
  );
  if (!post) throw new Error('Post not found');

  const url = `https://${DEFAULT_HOST}/blog/${post.slug}`;

  const submissions = await query<any>(
    `SELECT channel, action, status, requested_at, response_code, response_excerpt
     FROM public.seo_indexing_submissions
     WHERE post_id = $1
     ORDER BY requested_at DESC LIMIT 20`,
    [postId]
  );

  const inspection = await queryOne<any>(
    `SELECT * FROM public.seo_index_inspections WHERE post_id = $1 ORDER BY inspected_at DESC LIMIT 1`,
    [postId]
  );

  let overallStatus: IndexingStatusResult['status'] = 'draft';
  if (post.status === 'published') {
    // Honest status (Section 12): "indexed" only when Google's URL Inspection verdict is PASS.
    if (inspection?.verdict === 'PASS') {
      overallStatus = 'indexed';
    } else if (inspection && inspection.verdict) {
      overallStatus = 'not_indexed';
    } else if (inspection?.last_crawl_time) {
      overallStatus = 'crawled';
    } else if (submissions.some(s => s.status === 'accepted')) {
      overallStatus = 'accepted';
    } else if (submissions.some(s => s.status === 'submitted' || s.status === 'queued')) {
      overallStatus = 'submitted';
    } else {
      overallStatus = 'draft';
    }
  }

  return {
    postId,
    url,
    status: overallStatus,
    channelSubmissions: submissions.map(s => ({
      channel: s.channel,
      action: s.action,
      status: s.status,
      requestedAt: s.requested_at,
      responseExcerpt: s.response_excerpt,
    })),
    latestInspection: inspection ? {
      verdict: inspection.verdict,
      coverageState: inspection.coverage_state,
      lastCrawlTime: inspection.last_crawl_time,
      crawledAs: inspection.crawled_as,
      pageFetchState: inspection.page_fetch_state,
      robotsTxtState: inspection.robots_txt_state,
      userCanonical: inspection.user_canonical,
      googleCanonical: inspection.google_canonical,
    } : undefined,
  };
}

export async function isIndexNowEnabled(): Promise<boolean> {
  const setting = await queryOne<{ value: any }>(`SELECT value FROM public.seo_settings WHERE key = 'indexing'`);
  return Boolean(setting?.value?.indexnow_enabled);
}

export async function setIndexNowEnabled(enabled: boolean, actorId: string) {
  await getOrCreateIndexNowKey();
  await query(
    `UPDATE public.seo_settings SET value = value || $1::jsonb, updated_at = now() WHERE key = 'indexing'`,
    [JSON.stringify({ indexnow_enabled: enabled })]
  );
  await logAudit({ actorId, action: 'integration.indexnow_toggle', entityType: 'integration', afterState: { enabled } });
}
