import { NextRequest, NextResponse } from 'next/server';
import { getActiveRobotsTxt } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const content = await getActiveRobotsTxt(req.headers.get('x-forwarded-host') || req.headers.get('host'));
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
