import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/seo-system/db';

export const dynamic = 'force-dynamic';

/** Optional /llms.txt (FR-GEO-005). Returns 404 unless an admin enabled it. */
export async function GET() {
  const row = await queryOne<{ value: any }>(`SELECT value FROM public.seo_settings WHERE key = 'llms'`).catch(() => null);
  if (!row?.value?.enabled || !String(row.value.content || '').trim()) return new NextResponse('Not Found', { status: 404 });
  return new NextResponse(String(row.value.content), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
