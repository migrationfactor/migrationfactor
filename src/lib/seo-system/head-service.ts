import { escapeAttr, escapeHtml } from './sanitizer';
import { applyTitleTemplate, SeoSettings } from './settings-defaults';
import { buildSchemaGraph, renderSchemaScriptTag, SchemaContext } from './schema-service';

export interface HeadRenderInput {
  siteUrl?: string;
  siteName?: string;
  post: any;
  seo?: any;
  social?: any;
  schemaConfig?: any;
  geoAeo?: any;
  featuredMedia?: any;
  category?: any;
  authors?: any[];
  isPreview?: boolean;
  settings?: SeoSettings;
}

export interface RenderedHeadResult {
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  rawTags: string[];
  headHtml: string;
  schemaGraph: any;
}

/**
 * Builds the authoritative robots directive string
 */
export function buildRobotsDirective(seo: any, isPreview: boolean = false): string {
  if (isPreview) {
    return 'noindex, nofollow';
  }

  const index = seo?.robots_index !== false ? 'index' : 'noindex';
  const follow = seo?.robots_follow !== false ? 'follow' : 'nofollow';

  const parts = [index, follow];
  const adv = (typeof seo?.robots_advanced === 'object' && seo.robots_advanced !== null) ? seo.robots_advanced : {};

  if (adv?.nosnippet) {
    parts.push('nosnippet');
  } else {
    const maxSnippet = adv?.max_snippet !== undefined && adv.max_snippet !== null ? adv.max_snippet : -1;
    parts.push(`max-snippet:${maxSnippet}`);
  }

  const maxImage = adv?.max_image_preview || 'large';
  parts.push(`max-image-preview:${maxImage}`);

  const maxVideo = adv?.max_video_preview !== undefined && adv.max_video_preview !== null ? adv.max_video_preview : -1;
  parts.push(`max-video-preview:${maxVideo}`);

  if (adv?.noimageindex) parts.push('noimageindex');
  if (adv?.notranslate) parts.push('notranslate');
  if (adv?.noarchive) parts.push('noarchive');

  return parts.join(', ');
}

/**
 * Builds complete head tags with strict deduplication (FR-FE-001, FR-FE-004, Section 13.3)
 */
export function renderSeoHead(input: HeadRenderInput): RenderedHeadResult {
  const siteUrl = (input.siteUrl || 'https://migrationfactor.com').replace(/\/$/, '');
  const settings = input.settings;
  const siteName = settings?.siteName || input.siteName || 'Migration Factor';
  const post = input.post;
  const seo = input.seo || post.seo || {};
  const social = input.social || post.social || {};

  // Title cascade (Section 6.2)
  // Manual values always win; the template is only a fallback (Principle 2, FR-FE-003).
  const manualTitle = typeof seo.seo_title_raw === 'string' ? seo.seo_title_raw.trim() : '';
  const title =
    manualTitle ||
    (settings
      ? applyTitleTemplate(settings.titleTemplate, { title: post.title, siteName, separator: settings.titleSeparator })
      : seo.seo_title_effective || `${post.title} - ${siteName}`);

  // Description cascade
  // No manual description and no template => no tag; the excerpt is never injected here (TC-03).
  const manualDesc = typeof seo.meta_description_raw === 'string' ? seo.meta_description_raw.trim() : '';
  const metaDescription =
    manualDesc ||
    (settings?.descriptionTemplate
      ? settings.descriptionTemplate.replace(/%title%/g, post.title).replace(/%sitename%/g, siteName)
      : '');
  const socialFallbackDesc = metaDescription || post.excerpt || '';

  // Canonical cascade (Section 6.2, FR-SEO-004)
  const canonical = seo.canonical_url || `${siteUrl}/blog/${post.slug}`;

  // Robots
  const robots = buildRobotsDirective(seo, input.isPreview);

  // Social tags
  const ogTitle = (social.use_seo_values === false && social.og_title) ? social.og_title : title;
  const ogDesc = (social.use_seo_values === false && social.og_description) ? social.og_description : socialFallbackDesc;

  const featuredImg = input.featuredMedia || (post.featured_media_url ? { url: post.featured_media_url, alt: post.featured_media_alt } : null);
  const ogImgUrl = featuredImg?.url
    ? (featuredImg.url.startsWith('http') ? featuredImg.url : `${siteUrl}${featuredImg.url}`)
    : (settings?.defaultSocialImage
      ? (settings.defaultSocialImage.startsWith('http') ? settings.defaultSocialImage : `${siteUrl}${settings.defaultSocialImage}`)
      : `${siteUrl}/assets/img/logo.png`);
  const ogImgAlt = featuredImg?.alt || title;

  const twTitle = (social.use_seo_values === false && social.twitter_title) ? social.twitter_title : ogTitle;
  const twDesc = (social.use_seo_values === false && social.twitter_description) ? social.twitter_description : ogDesc;

  const pubDateIso = post.published_at ? new Date(post.published_at).toISOString() : new Date().toISOString();
  const modDateIso = post.modified_at ? new Date(post.modified_at).toISOString() : pubDateIso;

  // Build schema graph
  const schemaCtx: SchemaContext = {
    siteUrl,
    siteName,
    post,
    seo: {
      ...seo,
      seo_title_effective: title,
      meta_description_effective: metaDescription,
      canonical_url: canonical,
    },
    logoUrl: settings?.organization.logoUrl ? (settings.organization.logoUrl.startsWith('http') ? settings.organization.logoUrl : `${siteUrl}${settings.organization.logoUrl}`) : undefined,
    socialUrls: settings?.organization.sameAs,
    schemaConfig: input.schemaConfig || post.schema,
    geoAeo: input.geoAeo || post.geo_aeo,
    featuredMedia: featuredImg,
    category: input.category || post.categories?.[0],
    authors: input.authors || post.authors,
  };

  const schemaGraph = buildSchemaGraph(schemaCtx);
  const schemaScript = renderSchemaScriptTag(schemaGraph);

  // Assemble head tags with strict deduplication map (FR-FE-004)
  const tagMap = new Map<string, string>();

  tagMap.set('title', `<title>${escapeHtml(title)}</title>`);
  if (metaDescription) {
    tagMap.set('description', `<meta name="description" content="${escapeAttr(metaDescription)}">`);
  }
  tagMap.set('canonical', `<link rel="canonical" href="${escapeAttr(canonical)}">`);
  tagMap.set('robots', `<meta name="robots" content="${escapeAttr(robots)}">`);

  // Open Graph
  tagMap.set('og:locale', `<meta property="og:locale" content="en_AU">`);
  tagMap.set('og:type', `<meta property="og:type" content="article">`);
  tagMap.set('og:title', `<meta property="og:title" content="${escapeAttr(ogTitle)}">`);
  if (ogDesc) {
    tagMap.set('og:description', `<meta property="og:description" content="${escapeAttr(ogDesc)}">`);
  }
  tagMap.set('og:url', `<meta property="og:url" content="${escapeAttr(canonical)}">`);
  tagMap.set('og:site_name', `<meta property="og:site_name" content="${escapeAttr(siteName)}">`);
  tagMap.set('og:image', `<meta property="og:image" content="${escapeAttr(ogImgUrl)}">`);
  tagMap.set('og:image:width', `<meta property="og:image:width" content="1200">`);
  tagMap.set('og:image:height', `<meta property="og:image:height" content="630">`);
  tagMap.set('og:image:alt', `<meta property="og:image:alt" content="${escapeAttr(ogImgAlt)}">`);
  tagMap.set('article:published_time', `<meta property="article:published_time" content="${escapeAttr(pubDateIso)}">`);
  tagMap.set('article:modified_time', `<meta property="article:modified_time" content="${escapeAttr(modDateIso)}">`);

  // Twitter
  tagMap.set('twitter:card', `<meta name="twitter:card" content="${escapeAttr(social.twitter_card || 'summary_large_image')}">`);
  if (settings?.twitterSite) tagMap.set('twitter:site', `<meta name="twitter:site" content="${escapeAttr(settings.twitterSite)}">`);
  tagMap.set('twitter:title', `<meta name="twitter:title" content="${escapeAttr(twTitle)}">`);
  if (twDesc) {
    tagMap.set('twitter:description', `<meta name="twitter:description" content="${escapeAttr(twDesc)}">`);
  }
  tagMap.set('twitter:image', `<meta name="twitter:image" content="${escapeAttr(ogImgUrl)}">`);
  tagMap.set('twitter:image:alt', `<meta name="twitter:image:alt" content="${escapeAttr(ogImgAlt)}">`);

  // RSS feed link
  tagMap.set('rss', `<link rel="alternate" type="application/rss+xml" title="${escapeAttr(siteName)} Blog" href="${siteUrl}/blog/feed">`);

  // Schema script
  tagMap.set('schema', schemaScript);

  const rawTags = Array.from(tagMap.values());
  const headHtml = rawTags.join('\n');

  return {
    title,
    metaDescription,
    canonical,
    robots,
    rawTags,
    headHtml,
    schemaGraph,
  };
}

/**
 * Generates Next.js Metadata object from post record
 */
export function generateNextMetadata(input: HeadRenderInput) {
  const rendered = renderSeoHead(input);
  const siteName = input.settings?.siteName || input.siteName || 'Migration Factor';
  const socialDesc = rendered.metaDescription || input.post?.excerpt || undefined;

  return {
    title: rendered.title,
    description: rendered.metaDescription || undefined,
    alternates: {
      canonical: rendered.canonical,
    },
    robots: rendered.robots,
    openGraph: {
      title: rendered.title,
      description: socialDesc,
      url: rendered.canonical,
      siteName: siteName,
      locale: 'en_AU',
      type: 'article',
      images: [
        {
          url: input.featuredMedia?.url || `${input.siteUrl || ''}/assets/img/logo.png`,
          width: 1200,
          height: 630,
          alt: input.featuredMedia?.alt || rendered.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: input.settings?.twitterSite || undefined,
      title: rendered.title,
      description: socialDesc,
      images: [input.featuredMedia?.url || `${input.siteUrl || ''}/assets/img/logo.png`],
    },
  };
}
