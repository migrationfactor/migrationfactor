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
import { SITE_URL, SITE_NAME } from './site-config';

export function buildSchemaGraph(ctx: SchemaContext) {
  const siteUrl = (ctx.siteUrl || SITE_URL).replace(/\/$/, '');
  const siteName = ctx.siteName || SITE_NAME;
  // The canonical URL is the @id base (FR-SCH-002); migrated posts keep their original root URL.
  const canonicalUrl = ctx.seo?.canonical_url as string | undefined;
  const pageUrl = canonicalUrl && canonicalUrl.startsWith(siteUrl) ? canonicalUrl : `${siteUrl}/blog/${ctx.post.slug}`;

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
    slug: (siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'editorial') + '-team',
    display_name: siteName + ' Team',
    job_title: '',
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

const ARTICLE_TYPES = ['BlogPosting', 'Article', 'NewsArticle', 'TechArticle'];
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const isAbsUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\//i.test(v);
const nodeTypes = (n: any): string[] => (Array.isArray(n?.['@type']) ? n['@type'] : n?.['@type'] ? [n['@type']] : []);

/**
 * Internal structured-data validator (FR-SCH-005 / T6 / T7). Errors block publishing, warnings do not.
 * It checks the generated graph, not Google's eligibility: valid markup never guarantees rich results.
 */
export function validateSchemaGraph(graph: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!graph || typeof graph !== 'object') {
    errors.push('Schema must be a valid JSON object.');
    return { errors, warnings };
  }
  const ctx = graph['@context'];
  if (!ctx || !/^https?:\/\/schema\.org$/.test(String(Array.isArray(ctx) ? ctx[0] : ctx).replace(/\/$/, ''))) {
    errors.push('Schema @context must be https://schema.org.');
  }

  const nodes: any[] = Array.isArray(graph['@graph']) ? graph['@graph'] : [graph];
  let articles = 0;
  let hasWebPage = false;
  let hasWebSite = false;
  const ids = new Set<string>();

  for (const node of nodes) {
    const types = nodeTypes(node);
    if (types.length === 0) {
      errors.push('A schema node is missing @type.');
      continue;
    }
    if (node['@id']) {
      if (ids.has(node['@id'])) errors.push(`Duplicate schema node @id: ${node['@id']}.`);
      ids.add(node['@id']);
      if (!isAbsUrl(node['@id'])) errors.push(`@id must be an absolute URL (${node['@id']}).`);
    }
    for (const dateKey of ['datePublished', 'dateModified']) {
      if (node[dateKey] && !ISO_WITH_TZ.test(String(node[dateKey]))) {
        warnings.push(`${dateKey} should be ISO 8601 with a timezone (for example 2026-11-03T10:00:00+11:00).`);
      }
    }

    if (types.some((t) => ARTICLE_TYPES.includes(t))) {
      articles++;
      if (!node.headline) errors.push('Article node is missing required "headline".');
      else if (String(node.headline).length > 110) warnings.push('Article headline is longer than 110 characters.');
      if (!node.author || (Array.isArray(node.author) && node.author.length === 0)) errors.push('Article node is missing "author".');
      if (!node.datePublished) errors.push('Article node is missing "datePublished".');
      if (!node.dateModified) warnings.push('Article node has no "dateModified".');
      if (!node.image || (Array.isArray(node.image) && node.image.length === 0)) errors.push('Article node is missing "image".');
      else {
        const imgs = Array.isArray(node.image) ? node.image : [node.image];
        for (const i of imgs) if (typeof i === 'string' && !isAbsUrl(i)) errors.push('Article image URLs must be absolute.');
        if (imgs.length < 3) warnings.push('Google recommends 3 image crops (16:9, 4:3, 1:1) for Article markup.');
      }
      if (!node.publisher) warnings.push('Article node has no "publisher".');
      if (!node.mainEntityOfPage) warnings.push('Article node has no "mainEntityOfPage".');
    }
    if (types.includes('WebPage')) {
      hasWebPage = true;
      if (!isAbsUrl(node.url)) errors.push('WebPage node needs an absolute "url".');
    }
    if (types.includes('WebSite')) hasWebSite = true;
    if (types.includes('ImageObject') && !isAbsUrl(node.url)) errors.push('ImageObject needs an absolute "url".');
    if (types.includes('Organization')) {
      const logo = node.logo;
      if (!logo) warnings.push('Organization has no logo (minimum 112x112 px recommended).');
      else if (typeof logo === 'object' && logo.url && !isAbsUrl(logo.url)) errors.push('Organization logo URL must be absolute.');
    }
    if (types.includes('Person') && !node.name) errors.push('Person node is missing "name".');
    if (types.includes('BreadcrumbList')) {
      const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
      if (items.length < 2) errors.push('BreadcrumbList needs at least two items.');
      items.forEach((it: any, idx: number) => {
        if (it.position !== idx + 1) errors.push('BreadcrumbList positions must run 1..n.');
        if (!it.name) errors.push('BreadcrumbList item is missing "name".');
        if (idx < items.length - 1 && !isAbsUrl(it.item)) errors.push('BreadcrumbList items (except the last) need an absolute "item" URL.');
      });
    }
    if (types.includes('FAQPage')) {
      const qs = Array.isArray(node.mainEntity) ? node.mainEntity : [];
      if (qs.length < 2) errors.push('FAQPage needs at least 2 questions.');
      if (qs.some((q: any) => !q?.name || !q?.acceptedAnswer?.text)) errors.push('Every FAQ question needs a name and an answer text.');
    }
    if (types.includes('HowTo')) {
      const steps = Array.isArray(node.step) ? node.step : [];
      if (steps.length < 3) warnings.push('HowTo should have at least 3 steps.');
    }
  }

  if (articles > 1) errors.push('The page outputs more than one Article-type node (duplicate schema).');
  if (articles === 0) warnings.push('Schema graph contains no Article or BlogPosting node.');
  if (!hasWebPage) warnings.push('Schema graph contains no WebPage node.');
  if (!hasWebSite) warnings.push('Schema graph contains no WebSite node.');

  return { errors, warnings };
}

/**
 * Validates hand-written JSON-LD (FR-SCH-004). Returns the parsed value or plain-language errors with
 * line and column for syntax problems.
 */
export function validateCustomJsonLd(text: string): { errors: string[]; warnings: string[]; value: any | null } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const source = (text || '').trim();
  if (!source) return { errors, warnings, value: null };
  if (source.length > 50 * 1024) errors.push('Custom JSON-LD is larger than 50 KB.');
  if (/<\s*\/?\s*script/i.test(source)) errors.push('Custom JSON-LD must not contain <script> or HTML.');
  let value: any = null;
  try {
    value = JSON.parse(source);
  } catch (e: any) {
    const m = /position (\d+)/.exec(String(e.message));
    let where = '';
    if (m) {
      const before = source.slice(0, Number(m[1]));
      const line = before.split('\n').length;
      where = ` (line ${line}, column ${before.length - before.lastIndexOf('\n')})`;
    }
    errors.push(`Invalid JSON${where}: ${String(e.message).split('\n')[0]}`);
    return { errors, warnings, value: null };
  }
  const nodes: any[] = Array.isArray(value) ? value : value['@graph'] ? value['@graph'] : [value];
  const ctx = Array.isArray(value) ? 'https://schema.org' : value['@context'];
  if (!Array.isArray(value) && !/^https?:\/\/schema\.org\/?$/.test(String(ctx || ''))) errors.push('@context must be https://schema.org.');
  const allow = new Set([...ARTICLE_TYPES, 'Event', 'Course', 'VideoObject', 'Product', 'FAQPage', 'HowTo', 'Review', 'Recipe', 'Organization', 'Person', 'WebPage', 'BreadcrumbList', 'ImageObject', 'Thing', 'GovernmentService']);
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || !n['@type']) {
      errors.push('Every custom node needs an @type.');
      continue;
    }
    for (const t of nodeTypes(n)) if (!allow.has(t)) warnings.push(`Unsupported type for Google rich results: ${t}.`);
    if (n['@id'] && !isAbsUrl(n['@id'])) errors.push('Custom @id values must be absolute URLs.');
  }
  return { errors, warnings, value };
}

/**
 * Serializes the schema graph to an HTML <script> tag with context-aware escaping (SEC-05)
 */
export function renderSchemaScriptTag(graph: any): string {
  if (!graph) return '';
  const escaped = escapeJsonLd(graph);
  return `<script type="application/ld+json">${escaped}</script>`;
}
