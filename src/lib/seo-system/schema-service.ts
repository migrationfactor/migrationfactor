import { escapeJsonLd } from './sanitizer';

export interface SchemaContext {
  siteUrl: string;
  siteName: string;
  logoUrl?: string;
  socialUrls?: string[];
  post: {
    id: string;
    title: string;
    slug: string;
    word_count?: number;
    published_at?: string | Date;
    modified_at?: string | Date;
    body_json?: any;
    body_html?: string;
  };
  seo?: {
    seo_title_effective?: string;
    meta_description_effective?: string;
    canonical_url?: string;
    breadcrumb_title?: string;
    custom_h1?: string;
  };
  schemaConfig?: {
    article_type?: string;
    headline_override?: string;
    description_override?: string;
    faq_enabled?: boolean;
    howto_enabled?: boolean;
    custom_jsonld?: any;
    custom_mode?: 'add' | 'replace';
    disable_auto?: boolean;
  };
  geoAeo?: {
    primary_entity?: { name?: string; sameAs?: string };
  };
  featuredMedia?: {
    url: string;
    width?: number;
    height?: number;
    caption?: string;
    alt?: string;
  };
  category?: {
    name: string;
    slug: string;
  };
  authors?: Array<{
    id: string;
    slug: string;
    display_name: string;
    job_title?: string;
    same_as?: string[];
  }>;
}

/**
 * Builds the consolidated single @graph JSON-LD structure per SRS Section 10 & 13
 */
export function buildSchemaGraph(ctx: SchemaContext) {
  const siteUrl = (ctx.siteUrl || 'https://migrationfactor.com').replace(/\/$/, '');
  const siteName = ctx.siteName || 'Migration Factor';
  const pageUrl = `${siteUrl}/blog/${ctx.post.slug}`;

  // Check if auto schema disabled
  if (ctx.schemaConfig?.disable_auto) {
    if (ctx.schemaConfig?.custom_jsonld) {
      return ctx.schemaConfig.custom_jsonld;
    }
    return null;
  }

  // Check custom replace mode
  if (ctx.schemaConfig?.custom_mode === 'replace' && ctx.schemaConfig.custom_jsonld) {
    return ctx.schemaConfig.custom_jsonld;
  }

  const nodes: any[] = [];

  // 1. WebSite node
  const websiteId = `${siteUrl}/#website`;
  const orgId = `${siteUrl}/#organization`;

  nodes.push({
    '@type': 'WebSite',
    '@id': websiteId,
    url: `${siteUrl}/`,
    name: siteName,
    publisher: { '@id': orgId },
    inLanguage: 'en-AU',
  });

  // 2. Organization node
  const orgNode: any = {
    '@type': 'Organization',
    '@id': orgId,
    name: siteName,
    url: `${siteUrl}/`,
    logo: {
      '@type': 'ImageObject',
      url: ctx.logoUrl || `${siteUrl}/assets/img/logo.png`,
      width: 512,
      height: 512,
    },
  };
  if (ctx.socialUrls && ctx.socialUrls.length > 0) {
    orgNode.sameAs = ctx.socialUrls;
  }
  nodes.push(orgNode);

  // 3. WebPage node
  const webpageId = `${pageUrl}#webpage`;
  const primaryImageId = `${pageUrl}#primaryimage`;
  const breadcrumbId = `${pageUrl}#breadcrumb`;

  const pubDateIso = ctx.post.published_at
    ? new Date(ctx.post.published_at).toISOString()
    : new Date().toISOString();
  const modDateIso = ctx.post.modified_at
    ? new Date(ctx.post.modified_at).toISOString()
    : pubDateIso;

  const webpageNode: any = {
    '@type': 'WebPage',
    '@id': webpageId,
    url: pageUrl,
    name: ctx.seo?.seo_title_effective || ctx.post.title,
    isPartOf: { '@id': websiteId },
    breadcrumb: { '@id': breadcrumbId },
    datePublished: pubDateIso,
    dateModified: modDateIso,
    inLanguage: 'en-AU',
  };

  if (ctx.featuredMedia?.url) {
    webpageNode.primaryImageOfPage = { '@id': primaryImageId };
  }
  nodes.push(webpageNode);

  // 4. ImageObject node (if featured image exists)
  const fullImageUrl = ctx.featuredMedia?.url
    ? (ctx.featuredMedia.url.startsWith('http') ? ctx.featuredMedia.url : `${siteUrl}${ctx.featuredMedia.url}`)
    : null;

  if (fullImageUrl) {
    nodes.push({
      '@type': 'ImageObject',
      '@id': primaryImageId,
      url: fullImageUrl,
      contentUrl: fullImageUrl,
      width: ctx.featuredMedia?.width || 1200,
      height: ctx.featuredMedia?.height || 800,
      caption: ctx.featuredMedia?.caption || ctx.featuredMedia?.alt || ctx.post.title,
    });
  }

  // 5. Author Person nodes
  const authorNodes: any[] = [];
  const authorRefs: any[] = [];

  const authorsList = ctx.authors && ctx.authors.length > 0 ? ctx.authors : [{
    id: 'author-1',
    slug: 'migration-factor-team',
    display_name: 'Migration Factor Team',
    job_title: 'Migration Specialist',
    same_as: [],
  }];

  for (const author of authorsList) {
    const authorUrl = `${siteUrl}/blog/author/${author.slug}`;
    const personId = `${authorUrl}#person`;
    authorRefs.push({ '@id': personId });

    authorNodes.push({
      '@type': 'Person',
      '@id': personId,
      name: author.display_name,
      url: authorUrl,
      jobTitle: author.job_title || 'Registered Migration Specialist',
      worksFor: { '@id': orgId },
      sameAs: author.same_as || [],
    });
  }
  nodes.push(...authorNodes);

  // 6. BlogPosting / Article node
  const articleType = ctx.schemaConfig?.article_type || 'BlogPosting';
  const articleId = `${pageUrl}#article`;

  const headline = ctx.schemaConfig?.headline_override || ctx.seo?.seo_title_effective || ctx.post.title;
  const description = ctx.schemaConfig?.description_override || ctx.seo?.meta_description_effective || '';

  const articleNode: any = {
    '@type': articleType,
    '@id': articleId,
    headline,
    description,
    author: authorRefs,
    publisher: { '@id': orgId },
    datePublished: pubDateIso,
    dateModified: modDateIso,
    mainEntityOfPage: { '@id': webpageId },
    wordCount: ctx.post.word_count || 1200,
    inLanguage: 'en-AU',
  };

  if (fullImageUrl) {
    // Google Article recommendation: multiple aspect ratios
    articleNode.image = [
      fullImageUrl,
    ];
  }

  if (ctx.category?.name) {
    articleNode.articleSection = ctx.category.name;
  }

  if (ctx.geoAeo?.primary_entity?.name) {
    articleNode.about = {
      '@type': 'Thing',
      name: ctx.geoAeo.primary_entity.name,
      sameAs: ctx.geoAeo.primary_entity.sameAs || undefined,
    };
  }

  nodes.push(articleNode);

  // 7. BreadcrumbList node
  const breadcrumbItems: any[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
  ];

  let nextPos = 3;
  if (ctx.category?.name && ctx.category?.slug) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: nextPos++,
      name: ctx.category.name,
      item: `${siteUrl}/blog/category/${ctx.category.slug}`,
    });
  }

  const breadcrumbLastTitle = ctx.seo?.breadcrumb_title || ctx.post.title;
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: nextPos,
    name: breadcrumbLastTitle,
  });

  nodes.push({
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: breadcrumbItems,
  });

  // 8. Optional FAQPage node (FR-AEO-006, Section 10.4)
  if (ctx.schemaConfig?.faq_enabled && ctx.post.body_json?.blocks) {
    const faqQuestions: any[] = [];
    for (const b of ctx.post.body_json.blocks) {
      if (b.type === 'faq' && Array.isArray(b.data?.items)) {
        for (const item of b.data.items) {
          if (item.question && item.answer) {
            faqQuestions.push({
              '@type': 'Question',
              name: item.question.trim(),
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer.trim().replace(/<[^>]*>/g, ''),
              },
            });
          }
        }
      }
    }

    if (faqQuestions.length > 0) {
      nodes.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        isPartOf: { '@id': webpageId },
        mainEntity: faqQuestions,
      });
    }
  }

  // 9. Custom JSON-LD in 'add' mode
  if (ctx.schemaConfig?.custom_mode === 'add' && ctx.schemaConfig.custom_jsonld) {
    if (Array.isArray(ctx.schemaConfig.custom_jsonld['@graph'])) {
      nodes.push(...ctx.schemaConfig.custom_jsonld['@graph']);
    } else if (ctx.schemaConfig.custom_jsonld['@type']) {
      nodes.push(ctx.schemaConfig.custom_jsonld);
    }
  }

  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

/**
 * Validates a schema graph against required properties (FR-SCH-005)
 */
export function validateSchemaGraph(graph: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph || typeof graph !== 'object') {
    errors.push('Schema must be a valid JSON object.');
    return { errors, warnings };
  }

  const nodes = Array.isArray(graph['@graph']) ? graph['@graph'] : [graph];

  let hasArticle = false;
  let hasWebPage = false;
  let hasWebSite = false;

  for (const node of nodes) {
    if (!node['@type']) {
      errors.push('Schema node missing @type.');
      continue;
    }

    if (['BlogPosting', 'Article', 'NewsArticle'].includes(node['@type'])) {
      hasArticle = true;
      if (!node.headline) errors.push(`${node['@type']} node missing required 'headline'.`);
      if (!node.author || (Array.isArray(node.author) && node.author.length === 0)) {
        errors.push(`${node['@type']} node missing required 'author'.`);
      }
      if (!node.datePublished) errors.push(`${node['@type']} node missing 'datePublished'.`);
      if (!node.image) warnings.push(`${node['@type']} node has no image (recommended for Discover).`);
    }

    if (node['@type'] === 'WebPage') hasWebPage = true;
    if (node['@type'] === 'WebSite') hasWebSite = true;
  }

  if (!hasArticle) warnings.push('Schema graph contains no Article or BlogPosting node.');
  if (!hasWebPage) warnings.push('Schema graph contains no WebPage node.');
  if (!hasWebSite) warnings.push('Schema graph contains no WebSite node.');

  return { errors, warnings };
}

/**
 * Serializes the schema graph to an HTML <script> tag with context-aware escaping (SEC-05)
 */
export function renderSchemaScriptTag(graph: any): string {
  if (!graph) return '';
  const escaped = escapeJsonLd(graph);
  return `<script type="application/ld+json">${escaped}</script>`;
}
