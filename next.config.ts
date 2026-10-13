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
      { source: '/api/:path*', headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'Cache-Control', value: 'no-store' },
      ] },
    ];
  },
};

export default nextConfig;
