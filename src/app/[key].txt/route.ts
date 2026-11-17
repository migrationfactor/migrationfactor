import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateIndexNowKey } from '@/lib/seo-system/indexing-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const match = pathname.match(/\/([a-zA-Z0-9_-]+)\.txt$/);
  const key = match ? match[1] : '';
  const activeKey = await getOrCreateIndexNowKey();

  if (key && key === activeKey) {
    return new NextResponse(activeKey, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  return new NextResponse('Not Found', { status: 404 });
}
