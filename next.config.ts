import type { NextConfig } from 'next';
import { visaSubclasses } from './src/content/visa-subclasses/catalog';
import { legacyVisaPaths, visaPath } from './src/lib/visa-path';

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
