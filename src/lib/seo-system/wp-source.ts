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
