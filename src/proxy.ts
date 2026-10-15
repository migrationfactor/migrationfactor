import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie for admin routes and redirects signed-out
 * visitors to the login page. This is only an optimistic check: every admin page and
 * server action verifies the user and admin membership again on the server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isLogin = request.nextUrl.pathname === '/admin/login';
  if (!url || !key) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL('/admin/login', request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  // Verifies the JWT signature locally and refreshes an expired session; no Auth server call per request.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub && !isLogin) {
    const redirect = NextResponse.redirect(new URL('/admin/login', request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
