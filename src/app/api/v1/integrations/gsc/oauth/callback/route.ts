import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { completeAuth } from '@/lib/seo-system/gsc-service';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const back = (params: string) => {
    const res = NextResponse.redirect(`${url.origin}/seo-admin/seo/integrations?${params}`);
    res.cookies.delete({ name: 'gsc_oauth', path: '/api/v1/integrations/gsc/oauth' });
    return res;
  };

  const { auth, errorResponse } = await authenticateApiRequest(req, 'gsc.connect');
  if (errorResponse) return back('error=' + encodeURIComponent('Sign in to the admin panel first.'));

  if (url.searchParams.get('error')) return back('error=' + encodeURIComponent('Google sign-in was cancelled or denied.'));

  let saved: { state: string; verifier: string } | null = null;
  try {
    saved = JSON.parse(req.cookies.get('gsc_oauth')?.value || 'null');
  } catch {
    saved = null;
  }
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const a = Buffer.from(state);
  const b = Buffer.from(saved?.state || '');
  if (!saved || !code || a.length !== b.length || !timingSafeEqual(a, b)) {
    return back('error=' + encodeURIComponent('Sign-in session expired or was tampered with. Try connecting again.'));
  }

  try {
    await completeAuth(code, saved.verifier, url.origin, auth!.userId);
    return back('connected=1');
  } catch (err: any) {
    return back('error=' + encodeURIComponent(err.message || 'Could not connect to Google.'));
  }
}
