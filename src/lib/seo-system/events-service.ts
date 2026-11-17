import { queryOne } from './db';
import { SITE_URL } from './technical-seo';
import { notifyAfterChange } from './gsc-service';
import { isIndexNowEnabled, submitToIndexNow } from './indexing-service';
import { queueLiveVerification } from './verify-service';

/**
 * Post-change side effects (the "outbox consumers" of Section 15.5). Each step is independent and
 * best-effort: a failing notification must never fail a publish. Everything is logged in
 * seo_indexing_submissions / seo_scheduled_jobs so the admin can see what happened.
 */

async function publicUrl(postId: string): Promise<string | null> {
  const row = await queryOne<{ slug: string; legacy_path: string | null }>(`SELECT slug, legacy_path FROM public.seo_posts WHERE id = $1`, [postId]);
  return row ? `${SITE_URL}${row.legacy_path || `/blog/${row.slug}`}` : null;
}

/** Publish / significant update: sitemap resubmission, IndexNow (if on), live-page verification. */
export async function onPostPublishedOrUpdated(postId: string, actorId?: string): Promise<void> {
  try {
    await notifyAfterChange();
    if (await isIndexNowEnabled()) {
      const url = await publicUrl(postId);
      if (url) await submitToIndexNow([url], postId, actorId);
    }
    await queueLiveVerification(postId);
  } catch {
    /* best effort */
  }
}

/** Unpublish / trash / delete: the URL left the sitemap; tell IndexNow engines and Search Console. */
export async function onPostRemoved(url: string | null, postId?: string, actorId?: string): Promise<void> {
  try {
    await notifyAfterChange();
    if (url && (await isIndexNowEnabled())) await submitToIndexNow([url], postId, actorId);
  } catch {
    /* best effort */
  }
}

export { publicUrl as postPublicUrlById };
