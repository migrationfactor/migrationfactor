import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateIndexNowKey } from '@/lib/seo-system/indexing-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const activeKey = await getOrCreateIndexNowKey();

  if (key === activeKey) {
    return new NextResponse(activeKey, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return new NextResponse('Not Found', { status: 404 });
}
