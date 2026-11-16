import { NextResponse } from 'next/server';
import { generateSitemapIndex } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const xml = await generateSitemapIndex();
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
