import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { publishDueScheduledPosts, purgeExpiredTrash } from '@/lib/seo-system/scheduler-service';
import { runDueVerifications } from '@/lib/seo-system/verify-service';
import { checkExternalLinks } from '@/lib/seo-system/link-service';
import { retryFailedSubmissions } from '@/lib/seo-system/indexing-service';
import { runGscMaintenance } from '@/lib/seo-system/gsc-service';

export const dynamic = 'force-dynamic';

/** Vercel Cron: publishes due scheduled blog posts. Needs `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const given = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  const publishing = await publishDueScheduledPosts();
  const searchConsole = await runGscMaintenance();
  const safe = async <T,>(fn: () => Promise<T>) => { try { return await fn(); } catch (e: any) { return { error: e?.message || 'failed' }; } };
  const [verification, links, trash, indexingRetry] = [await safe(runDueVerifications), await safe(() => checkExternalLinks(60)), await safe(purgeExpiredTrash), await safe(() => retryFailedSubmissions())];
  return NextResponse.json({ publishing, searchConsole, verification, links, trash, indexingRetry });
}
