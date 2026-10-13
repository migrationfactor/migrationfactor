import type { NextConfig } from 'next';
import { visaSubclasses } from './src/content/visa-subclasses/catalog';
import { splitVisaSlug } from './src/lib/visa-path';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async redirects() {
    return visaSubclasses.flatMap(({ slug }) => { const parts = splitVisaSlug(slug); return parts ? [{ source: `/services/${slug}`, destination: `/services/${parts.join('/')}`, permanent: true }] : []; });
  },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
