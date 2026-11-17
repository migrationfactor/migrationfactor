import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie for admin routes and redirects signed-out
 * visitors to the login page. This is only an optimistic check: every admin page and
 * server action verifies the user and admin membership again on the server.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const migrated = await handleMigratedPost(request);
  if (migrated) return migrated;
  if (pathname.startsWith('/blog')) return handleBlogPost(request);
  if (pathname.startsWith('/preview/')) {
    // FR-BLG-010: previews are never cached or indexed.
    const res = NextResponse.next();
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }

  // The matcher now covers the whole site (for migrated-post URLs); only admin areas need the session logic below.
  if (!(pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/seo-admin' || pathname.startsWith('/seo-admin/'))) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isSeo = pathname === '/seo-admin' || pathname.startsWith('/seo-admin/');
  const loginPath = isSeo ? '/seo-admin/login' : '/admin/login';
  const isLogin = pathname === loginPath;
  if (!url || !key) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL(loginPath, request.url));
  }

  // The SEO panel shares the admin login; its layout needs the path to gate rendering.
  request.headers.set('x-pathname', pathname);
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
    const redirect = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

// ---- WordPress-migrated posts --------------------------------------------------------------------------
// Migrated posts keep their original root-level WordPress URL (/slug/, with trailing slash). That needs
// skipTrailingSlashRedirect (next.config.ts), so the default "strip the trailing slash" behaviour is
// reproduced here for every other path to leave the rest of the site unchanged.
let legacyCache: { at: number; map: Map<string, string> } | null = null;

async function legacyPaths(): Promise<Map<string, string>> {
  if (legacyCache && Date.now() - legacyCache.at < 60_000) return legacyCache.map;
  try {
    const { query } = await import('@/lib/seo-system/db');
    const rows = await query<{ legacy_path: string; slug: string }>(
      `SELECT legacy_path, slug FROM public.seo_posts WHERE legacy_path IS NOT NULL AND status = 'published'`);
    legacyCache = { at: Date.now(), map: new Map(rows.map((r) => [r.legacy_path, r.slug])) };
  } catch {
    legacyCache = { at: Date.now() - 50_000, map: legacyCache?.map ?? new Map() }; // retry in 10s, keep last good list
  }
  return legacyCache.map;
}

async function handleMigratedPost(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, search } = request.nextUrl;
  if (pathname === '/') return null;
  const withSlash = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const segments = withSlash.split('/').filter(Boolean);
  const slug = segments.length === 1 ? (await legacyPaths()).get(withSlash.toLowerCase() === withSlash ? withSlash : withSlash.toLowerCase()) : undefined;
  if (slug) {
    if (withSlash.toLowerCase() !== withSlash || pathname !== withSlash) {
      return NextResponse.redirect(new URL(`${withSlash.toLowerCase()}${search}`, request.url), 301);
    }
    return NextResponse.rewrite(new URL(`/blog/${slug}${search}`, request.url));
  }
  if (pathname.endsWith('/') && !/\.[^/]+\/$/.test(pathname)) {
    return NextResponse.redirect(new URL(`${pathname.replace(/\/+$/, '')}${search}`, request.url), 308);
  }
  return null;
}

const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>410 Gone - Migration Factor</title></head><body style="font-family:system-ui,sans-serif;text-align:center;padding:80px 20px;color:#042628"><h1>410 - This article has been removed</h1><p>Explore our latest guides in the <a href="/blog/" style="color:#0b666a">Migration Factor blog</a>.</p></body></html>`;

function gone() {
  return new NextResponse(GONE_HTML, {
    status: 410,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'public, max-age=300' },
  });
}

/**
 * SRS 11.5 / FR-TEC-009/010/014: blog post URLs must answer with real HTTP status codes.
 * Next.js pages cannot emit 301 (redirect() sends 307) or 410, so they are resolved here:
 * uppercase paths, redirects table, trashed / 410-unpublished posts and deleted-URL tombstones.
 * Any failure falls through to the normal page so a database hiccup never takes the blog down.
 */
async function handleBlogPost(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();
  const rawSlug = decodeURIComponent(match[1]);
  const slug = rawSlug.toLowerCase();
  if (['feed', 'page', 'author', 'category', 'tag'].includes(slug)) return NextResponse.next();

  if (rawSlug !== slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/blog/${slug}`;
    return NextResponse.redirect(url, 301);
  }

  try {
    const { queryOne } = await import('@/lib/seo-system/db');
    const path = `/blog/${slug}`;

    const redirect = await queryOne<{ target_url: string; http_code: number }>(
      `SELECT target_url, http_code FROM public.seo_redirects
       WHERE source_path IN ($1, $2) AND active = true LIMIT 1`,
      [path, path.slice(0, -1)]
    );
    if (redirect) {
      if (redirect.http_code === 410) return gone();
      if (redirect.http_code === 451) return new NextResponse('Unavailable for legal reasons', { status: 451 });
      const target = new URL(redirect.target_url, request.url);
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, redirect.http_code);
    }

    const post = await queryOne<{ status: string; unpublish_behavior: string | null }>(
      `SELECT status, unpublish_behavior FROM public.seo_posts WHERE slug = $1`,
      [slug]
    );
    if (post) {
      const legacy = await queryOne<{ legacy_path: string | null }>(`SELECT legacy_path FROM public.seo_posts WHERE slug = $1`, [slug]);
      // A migrated post lives at its original WordPress URL; the /blog/ copy permanently redirects there.
      if (legacy?.legacy_path) return NextResponse.redirect(new URL(legacy.legacy_path, request.url), 301);
      if (post.status === 'trashed') return gone();
      if (post.status === 'unpublished' && post.unpublish_behavior === '410') return gone();
      return NextResponse.next();
    }

    const tomb = await queryOne<{ http_code: number }>(
      `SELECT http_code FROM public.seo_url_tombstones WHERE path IN ($1, $2) LIMIT 1`,
      [path, path.slice(0, -1)]
    );
    if (tomb) return gone();
  } catch {
    // fall through to the page
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, API routes and files with an extension.
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
