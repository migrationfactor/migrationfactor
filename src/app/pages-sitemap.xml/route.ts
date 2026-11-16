import { NextResponse } from 'next/server';
import { services } from '@/content/services';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import { coaching } from '@/content/coaching';
import { SITE_URL } from '@/lib/constants';
import { visaPath } from '@/lib/visa-path';
import { allTools as tools } from '@/features/immigration-tools/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  const routes = [
    `${SITE_URL}/`,
    `${SITE_URL}/about/`,
    `${SITE_URL}/services/`,
    ...[...new Map([...services, ...visaSubclasses].map(service => [service.slug, service])).values()].map((s) => (
      `${SITE_URL}${visaPath(s.slug)}/`
    )),
    `${SITE_URL}/countries/`,
    `${SITE_URL}/coaching/`,
    ...coaching.map((c) => `${SITE_URL}/coaching/${c.slug}/`),
    `${SITE_URL}/faq/`,
    `${SITE_URL}/contact/`,
    `${SITE_URL}/consultation`,
    `${SITE_URL}/tools`,
    ...tools.map(tool => `${SITE_URL}/tools/${tool.slug}`),
    `${SITE_URL}/guides/preparing-your-profile/`,
    `${SITE_URL}/guides/document-checklist/`,
  ];

  const urlEntries = routes.map(r => (
    `  <url>\n    <loc>${r}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`
  ));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
