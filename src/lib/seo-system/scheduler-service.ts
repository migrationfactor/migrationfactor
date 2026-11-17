import { query, queryOne } from './db';
import { publishPost } from './posts-service';
import { logAudit } from './audit';
import { notifyAfterChange } from './gsc-service';

let lastRun = 0;

/**
 * Publishes scheduled posts whose time has come (FR-BLG-006). Jobs are durable rows in
 * seo_scheduled_jobs; anything missed while the app was down is published on the next run and
 * logged as "published late". Safe to call concurrently: a job is claimed atomically.
 */
export async function publishDueScheduledPosts(): Promise<{ published: number; failed: number }> {
  let published = 0;
  let failed = 0;

  // Pick up scheduled posts that have no pending job (e.g. job rows lost)
  await query(
    `INSERT INTO public.seo_scheduled_jobs (event_type, aggregate_id, payload, available_at)
     SELECT 'post.scheduled_publish', p.id, jsonb_build_object('postId', p.id), p.scheduled_at
     FROM public.seo_posts p
     WHERE p.status = 'scheduled' AND p.scheduled_at <= now()
       AND NOT EXISTS (SELECT 1 FROM public.seo_scheduled_jobs j
                       WHERE j.aggregate_id = p.id AND j.event_type = 'post.scheduled_publish' AND j.status IN ('pending','processing'))`
  );

  for (;;) {
    const job = await queryOne<{ id: number; aggregate_id: string; available_at: string; attempts: number }>(
      `UPDATE public.seo_scheduled_jobs SET status = 'processing', attempts = attempts + 1
       WHERE id = (SELECT id FROM public.seo_scheduled_jobs
                   WHERE event_type = 'post.scheduled_publish' AND status = 'pending' AND available_at <= now()
                   ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED)
       RETURNING id, aggregate_id, available_at, attempts`
    );
    if (!job) break;

    const post = await queryOne<{ status: string; created_by: string | null }>(
      `SELECT status, created_by FROM public.seo_posts WHERE id = $1`,
      [job.aggregate_id]
    );
    if (!post || post.status !== 'scheduled') {
      await query(`UPDATE public.seo_scheduled_jobs SET status = 'done' WHERE id = $1`, [job.id]);
      continue;
    }

    try {
      await publishPost(job.aggregate_id, post.created_by as string, true);
      const lateMin = Math.round((Date.now() - new Date(job.available_at).getTime()) / 60000);
      await query(`UPDATE public.seo_scheduled_jobs SET status = 'done' WHERE id = $1`, [job.id]);
      if (lateMin >= 2) {
        await logAudit({
          actorId: post.created_by,
          action: 'post.published_late',
          entityType: 'post',
          entityId: job.aggregate_id,
          afterState: { late_by_minutes: lateMin },
        });
      }
      published++;
    } catch (err: any) {
      failed++;
      const final = job.attempts >= 3;
      await query(
        `UPDATE public.seo_scheduled_jobs SET status = $2, last_error = $3,
           available_at = now() + interval '10 minutes' WHERE id = $1`,
        [job.id, final ? 'failed' : 'pending', String(err?.message || err).slice(0, 500)]
      );
    }
  }
  if (published > 0) await notifyAfterChange();
  return { published, failed };
}

/** Throttled trigger for public requests so schedules fire even without a frequent cron. */
export async function publishDueScheduledPostsThrottled(): Promise<void> {
  if (Date.now() - lastRun < 60_000) return;
  lastRun = Date.now();
  try {
    await publishDueScheduledPosts();
  } catch {
    // never break a public page because the scheduler failed
  }
}
