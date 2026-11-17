import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listProperties, selectProperty } from '@/lib/seo-system/gsc-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return errorResponse;
  try {
    return NextResponse.json(await listProperties());
  } catch (err: any) {
    return NextResponse.json({ error: 'gsc_error', message: err.message }, { status: err.status || 502 });
  }
}

export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await selectProperty(String(body.siteUrl || ''), auth!.userId));
  } catch (err: any) {
    return NextResponse.json({ error: 'gsc_error', message: err.message }, { status: err.status || 502 });
  }
}
