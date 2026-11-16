import { NextResponse } from 'next/server';
import { getActiveRobotsTxt } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const content = await getActiveRobotsTxt();
  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
