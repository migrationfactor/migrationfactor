import type { NextConfig } from 'next';
import { visaSubclasses } from './src/content/visa-subclasses/catalog';
import { legacyVisaPaths, visaPath } from './src/lib/visa-path';

// The site loads only its own scripts, styles, fonts and images. Next.js needs inline scripts for
// hydration and inline styles for style attributes. Development is excluded because it relies on eval.
// Signing PDFs and uploads go directly between the browser and private Supabase Storage via signed URLs.
const supabaseOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin; } catch { return ''; } })();
const contentSecurityPolicy = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "media-src 'self'", `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ''}`,
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ');
const productionOnly = process.env.NODE_ENV === 'production' ? [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
] : [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async redirects() {
    // Redirect legacy subclass aliases; keep main service URLs separate from their guides.
    const contributory = visaPath('contributory-parent-visa-143-173-864-884');
    return [
      { source: '/services/contributory-parent-visa', destination: contributory, permanent: true },
      ...visaSubclasses.flatMap(({ slug }) => legacyVisaPaths(slug).map(source => ({ source, destination: visaPath(slug), permanent: true }))),
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ...productionOnly,
      ] },
      // Reuse public assets on repeat visits, while still allowing updated files to refresh.
      { source: '/:folder(media|brand|fonts|reference)/:path*', headers: [
        { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
      ] },
      { source: '/api/:path*', headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'no-store' },
      ] },
    ];
  },
};

export default nextConfig;
