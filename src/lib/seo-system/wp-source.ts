import type { Metadata } from 'next';
import { queryOne } from './db';

/** Rank Math head output captured from WordPress at migration time (see scripts/wordpress-migration). */
export interface WpSource {
  wp_id: number;
  wp_path: string;
  rankmath: {
    title: string | null; description: string | null; canonical: string | null; robots: string | null;
    og: Record<string, string[]>; twitter: Record<string, string[]>; article: Record<string, string[]>; jsonld: unknown[];
  };
}

export async function getWpSource(postId: string): Promise<WpSource | null> {
  return queryOne<WpSource>(`SELECT wp_id, wp_path, rankmath FROM public.seo_wp_post_source WHERE post_id = $1`, [postId]);
}

/** Server-rendered metadata that reproduces the WordPress/Rank Math head for a migrated post. */
export function buildWpMetadata(src: WpSource): Metadata {
  const rm = src.rankmath;
  const og = rm.og;
  const tw = rm.twitter;
  const first = (bag: Record<string, string[]>, key: string) => bag[key]?.[0];
  const num = (v?: string) => (v ? Number(v) : undefined);
  const other: Record<string, string> = {};
  for (const [k, v] of Object.entries(tw)) if (/^twitter:(label|data)\d+$/.test(k)) other[k] = v[0];

  return {
    title: { absolute: rm.title ?? '' },
    description: rm.description ?? undefined,
    alternates: rm.canonical ? { canonical: rm.canonical } : undefined,
    robots: rm.robots ?? undefined,
    openGraph: {
      type: 'article',
      locale: first(og, 'og:locale'),
      title: first(og, 'og:title'),
      description: first(og, 'og:description'),
      url: first(og, 'og:url'),
      siteName: first(og, 'og:site_name'),
      images: og['og:image']?.map((url) => ({
        url, secureUrl: first(og, 'og:image:secure_url'), width: num(first(og, 'og:image:width')), height: num(first(og, 'og:image:height')),
        alt: first(og, 'og:image:alt'), type: first(og, 'og:image:type'),
      })),
      section: first(rm.article, 'article:section'),
      publishedTime: first(rm.article, 'article:published_time'),
      modifiedTime: first(rm.article, 'article:modified_time'),
    },
    twitter: {
      card: (first(tw, 'twitter:card') as 'summary_large_image' | undefined) ?? 'summary_large_image',
      title: first(tw, 'twitter:title'), description: first(tw, 'twitter:description'), images: tw['twitter:image'],
    },
    other,
  };
}

/** Escapes `<` so JSON-LD can never close its own script tag. */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Principle 1/2: what the admin saves is what Google crawls. A migrated post starts from the frozen
 * Rank Math head, but the editable SEO / social / schema fields (seeded from that head at import)
 * are authoritative: any value saved in the panel replaces the snapshot value, and the regenerated
 * JSON-LD graph takes over as soon as a value that appears in it has changed.
 */
export function applyAdminOverrides(
  base: Metadata,
  src: WpSource,
  seo: any,
  social: any,
  schemaConfig: any,
  robots: string | null,
): { metadata: Metadata; schemaStale: boolean } {
  const rm = src.rankmath;
  const title = norm(seo?.seo_title_raw) || norm(rm.title);
  const description = seo ? norm(seo.meta_description_raw) : norm(rm.description);
  const canonical = norm(seo?.canonical_url) || norm(rm.canonical);

  const rmOgTitle = rm.og['og:title']?.[0];
  const rmOgDesc = rm.og['og:description']?.[0];
  const manualSocial = social && social.use_seo_values === false;
  const ogTitle = (manualSocial && norm(social.og_title)) || (rmOgTitle && rmOgTitle === rm.title ? title : rmOgTitle) || title;
  const ogDesc = (manualSocial && norm(social.og_description)) || (rmOgDesc && rmOgDesc === rm.description ? description : rmOgDesc) || description;
  const twTitle = (manualSocial && norm(social.twitter_title)) || ogTitle;
  const twDesc = (manualSocial && norm(social.twitter_description)) || ogDesc;

  const metadata: Metadata = {
    ...base,
    title: { absolute: title },
    description: description || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: robots ?? base.robots,
    openGraph: { ...(base.openGraph as any), title: ogTitle, description: ogDesc || undefined, url: canonical || (base.openGraph as any)?.url },
    twitter: { ...(base.twitter as any), title: twTitle, description: twDesc || undefined },
  };

  const schemaStale =
    title !== norm(rm.title) ||
    description !== norm(rm.description) ||
    (canonical !== '' && canonical !== norm(rm.canonical)) ||
    Boolean(schemaConfig?.disable_auto) ||
    (schemaConfig?.custom_jsonld != null && Object.keys(schemaConfig.custom_jsonld).length > 0);
  return { metadata, schemaStale };
}
