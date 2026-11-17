import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getOrCreateIndexNowKey, isIndexNowEnabled, setIndexNowEnabled } from '@/lib/seo-system/indexing-service';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  const key = await getOrCreateIndexNowKey();
  return NextResponse.json({ enabled: await isIndexNowEnabled(), keyUrl: `${SITE_URL}/${key}.txt` });
}

export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  await setIndexNowEnabled(Boolean(body.enabled), auth!.userId);
  return NextResponse.json({ enabled: Boolean(body.enabled) });
}
