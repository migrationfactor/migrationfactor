import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { createAuthRequest, googleConfigured } from '@/lib/seo-system/gsc-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return errorResponse;
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/seo-admin/seo/integrations?error=${encodeURIComponent('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.')}`);
  }
  const write = new URL(req.url).searchParams.get('mode') !== 'read';
  const { url, state, verifier } = createAuthRequest(origin, write);
  const res = NextResponse.redirect(url);
  res.cookies.set('gsc_oauth', JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/integrations/gsc/oauth',
    maxAge: 600,
  });
  return res;
}
