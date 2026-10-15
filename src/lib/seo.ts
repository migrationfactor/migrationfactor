import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { company, socialLinks } from '@/content/company';

export function absoluteUrl(path = '/') {
  const clean = path === '/' ? '/' : path.replace(/\/+$/, '');
  return `${SITE_URL}${clean}`;
}

export function pageMetadata(path: string, title: string, description: string): Metadata {
  const cleanTitle = title.replace(/\s*\| Migration Factor$/, '');
  const fullTitle = `${cleanTitle} | Migration Factor`;
  return {
    title: path === '/' ? { absolute: fullTitle } : cleanTitle, description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: { type: 'website', locale: 'en_AU', siteName: company.name,
      url: absoluteUrl(path), title: fullTitle, description,
      images: [{ url: absoluteUrl('/brand/social.webp'), alt: company.name }] },
    twitter: { card: 'summary_large_image', title: fullTitle, description,
      images: [absoluteUrl('/brand/social.webp')] },
  };
}

export const organization = {
  '@context': 'https://schema.org', '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`, name: company.name, url: SITE_URL,
  logo: absoluteUrl('/brand/mark.webp'), email: company.email, telephone: company.tel,
  // Verified profiles only; a search-results link is not the business's own page.
  sameAs: socialLinks.filter(link => link.url && !link.url.includes('/search/')).map(link => link.url),
};

export function pageSchema(path: string, name: string, description: string, kind: 'WebPage' | 'Service' | 'Article' = 'WebPage') {
  const url = absoluteUrl(path);
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': kind, '@id': `${url}#content`, name, ...(kind === 'Article' ? { headline: name, author: { '@id': organization['@id'] } } : {}), description, url,
      ...(kind === 'Service' ? { provider: { '@id': organization['@id'] } } : { isPartOf: { '@id': `${SITE_URL}/#website` } }) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      ...(path === '/' ? [] : [{ '@type': 'ListItem', position: 2, name, item: url }]),
    ] },
  ] };
}
