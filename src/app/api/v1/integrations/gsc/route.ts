import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { disconnect, getConnection, redirectUri } from '@/lib/seo-system/gsc-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  const conn = await getConnection();
  return NextResponse.json({ ...conn, redirectUri: redirectUri(new URL(req.url).origin) });
}

export async function DELETE(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return errorResponse;
  await disconnect(auth!.userId);
  return NextResponse.json({ success: true });
}
