import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { refreshSitemapStatus, submitSitemap } from '@/lib/seo-system/gsc-service';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'indexing.submit');
  if (errorResponse) return errorResponse;
  try {
    const submitted = await submitSitemap(auth!.userId, true);
    return NextResponse.json(submitted);
  } catch (err: any) {
    return NextResponse.json({ error: 'gsc_error', message: err.message }, { status: err.status || 502 });
  }
}

/** Fetches Google's processing status for the sitemap (last downloaded, errors, warnings). */
export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  try {
    return NextResponse.json(await refreshSitemapStatus());
  } catch (err: any) {
    return NextResponse.json({ error: 'gsc_error', message: err.message }, { status: err.status || 502 });
  }
}
