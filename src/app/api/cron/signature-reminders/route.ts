import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { jsonResponse } from '@/lib/api-guard';
import { runScheduledReminders } from '@/lib/signatures/service';

/** Daily Vercel Cron job: sends due reminders and expires old links. Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET || '';
  const given = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const ok = secret.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return jsonResponse({ message: 'Unauthorized.' }, 401);
  return jsonResponse(await runScheduledReminders());
}
