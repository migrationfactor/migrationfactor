import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSeoSettings } from '@/lib/seo-system/settings-service';
import { renderArticleBody, isOptimizableSrc } from '@/lib/seo-system/article-render';
import { queryOne, query } from '@/lib/seo-system/db';
import { renderSeoHead, generateNextMetadata, buildRobotsDirective } from '@/lib/seo-system/head-service';
import { publishDueScheduledPostsThrottled } from '@/lib/seo-system/scheduler-service';
import { SITE_URL, resolveRedirect, checkTombstoneOrRecord404 } from '@/lib/seo-system/technical-seo';
import { getWpSource, buildWpMetadata, applyAdminOverrides, jsonLdString } from '@/lib/seo-system/wp-source';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPostData(slug: string) {
  await publishDueScheduledPostsThrottled();
  // Check redirects first
  const redirectMatch = await resolveRedirect(`/blog/${slug}`);
  if (redirectMatch) {
    redirect(redirectMatch.target);
  }

  const post = await queryOne<any>(
    `SELECT p.*,
            m.url as featured_media_url, m.alt_text as featured_media_alt, m.caption as featured_media_caption,
            m.width as featured_media_width, m.height as featured_media_height,
            c.name as category_name, c.slug as category_slug
     FROM public.seo_posts p
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_categories c ON c.id = p.primary_category_id
     WHERE p.slug = $1`,
    [slug]
  );

  if (!post) {
    await checkTombstoneOrRecord404(`/blog/${slug}`);
    return null;
  }

  // Only published posts are publicly accessible (FR-BLG-001)
  if (post.status !== 'published') {
    if (post.status === 'unpublished' && post.unpublish_behavior === '410') {
      // 410 Gone
      return { isGone: true };
    }
    return null;
  }

  const seo = await queryOne<any>(`SELECT * FROM public.seo_post_seo WHERE post_id = $1`, [post.id]);
  const social = await queryOne<any>(`SELECT * FROM public.seo_post_social WHERE post_id = $1`, [post.id]);
  const schemaConfig = await queryOne<any>(`SELECT * FROM public.seo_post_schema WHERE post_id = $1`, [post.id]);
  const geoAeo = await queryOne<any>(`SELECT * FROM public.seo_post_geo_aeo WHERE post_id = $1`, [post.id]);

  const authors = await query<any>(
    `SELECT a.*, pa.position, pa.role
     FROM public.seo_post_authors pa
     JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE pa.post_id = $1 ORDER BY pa.position ASC`,
    [post.id]
  );

  const references = await query<any>(
    `SELECT * FROM public.seo_post_references WHERE post_id = $1 ORDER BY position ASC`,
    [post.id]
  );

  // Posts migrated from WordPress keep their Rank Math head and JSON-LD verbatim (no regenerated duplicate schema).
  const wpSource = post.wp_id ? await getWpSource(post.id) : null;

  return {
    post,
    wpSource,
    seo,
    social,
    schemaConfig,
    geoAeo,
    authors,
    references,
    category: post.category_name ? { name: post.category_name, slug: post.category_slug } : undefined,
  };
}

/** Server-rendered related articles (FR-LNK-003): same category or shared tags, newest first. */
async function getRelatedPosts(postId: string, categoryId: string | null) {
  return query<any>(
    `SELECT DISTINCT p.id, p.slug, p.title, p.published_at FROM public.seo_posts p
     LEFT JOIN public.seo_post_tags pt ON pt.post_id = p.id
     WHERE p.status = 'published' AND p.id <> $1 AND (
       ($2::uuid IS NOT NULL AND p.primary_category_id = $2::uuid)
       OR pt.tag_id IN (SELECT tag_id FROM public.seo_post_tags WHERE post_id = $1))
     ORDER BY p.published_at DESC LIMIT 4`,
    [postId, categoryId]
  );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getPostData(slug);
  if (!data || 'isGone' in data) {
    return {
      title: 'Page Not Found - Migration Factor',
      robots: 'noindex, nofollow',
    };
  }

  if (data.wpSource) {
    const robots = buildRobotsDirective(data.seo);
    return applyAdminOverrides(buildWpMetadata(data.wpSource), data.wpSource, data.seo, data.social, data.schemaConfig, robots).metadata;
  }

  const settings = await getSeoSettings();
  return generateNextMetadata({
    siteUrl: SITE_URL,
    siteName: settings.siteName,
    settings,
    post: data.post,
    seo: data.seo,
    social: data.social,
    schemaConfig: data.schemaConfig,
    geoAeo: data.geoAeo,
    featuredMedia: data.post.featured_media_url ? {
      url: data.post.featured_media_url,
      alt: data.post.featured_alt_override || data.post.featured_media_alt,
      width: data.post.featured_media_width,
      height: data.post.featured_media_height,
      caption: data.post.featured_caption_override || data.post.featured_media_caption,
    } : undefined,
    category: data.category,
    authors: data.authors,
  });
}

export default async function BlogPostPage(props: Props) {
  const { slug } = await props.params;
  const data = await getPostData(slug);

  if (!data) notFound();
  if ('isGone' in data) {
    return (
      <div className="blog-page-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ fontSize: '2rem', color: '#042628' }}>410 — Content Removed</h1>
        <p style={{ color: '#6b7280', marginTop: 12 }}>
          This article has been permanently removed. Explore our latest guides in the <Link href="/blog" style={{ color: '#0b666a' }}>Blog</Link>.
        </p>
      </div>
    );
  }

  const { post, seo, authors, category, references } = data;
  const settings = await getSeoSettings();
  const related = await getRelatedPosts(post.id, post.primary_category_id);
  const bodyHtml = renderArticleBody(post.body_html, { autoTocMinH2: settings.autoTocMinH2 });
  const quickAnswer = (data.geoAeo?.answer_summary || '').trim();

  const h1Title = seo?.custom_h1 || post.title;
  const breadcrumbTitle = seo?.breadcrumb_title || post.title;

  const pubDateIso = post.published_at ? new Date(post.published_at).toISOString() : '';
  const pubDateDisplay = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const modDateIso = post.modified_at ? new Date(post.modified_at).toISOString() : pubDateIso;
  const modDateDisplay = post.modified_at
    ? new Date(post.modified_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : pubDateDisplay;

  // Build rendered head for JSON-LD schema inclusion in the page
  const headData = renderSeoHead({
    siteUrl: SITE_URL,
    siteName: settings.siteName,
    settings,
    post,
    seo,
    social: data.social,
    schemaConfig: data.schemaConfig,
    geoAeo: data.geoAeo,
    featuredMedia: post.featured_media_url ? {
      url: post.featured_media_url,
      alt: post.featured_alt_override || post.featured_media_alt,
      width: post.featured_media_width,
      height: post.featured_media_height,
      caption: post.featured_caption_override || post.featured_media_caption,
    } : undefined,
    category,
    authors,
  });

  const wpSchemaStale = data.wpSource
    ? applyAdminOverrides({}, data.wpSource, seo, data.social, data.schemaConfig, null).schemaStale
    : false;

  return (
    <div className="blog-page-container">
      {/* Schema.org single @graph JSON-LD (FR-SCH-001) */}
      {data.wpSource && !wpSchemaStale
        ? data.wpSource.rankmath.jsonld.map((block, i) => (
            <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(block) }} />
          ))
        : (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdString(headData.schemaGraph) }}
          />
        )}
      {/* Rank Math emits og:updated_time, which the Metadata API cannot express; React hoists this into <head>. */}
      {data.wpSource?.rankmath.og['og:updated_time']?.map((v) => <meta key={v} property="og:updated_time" content={v} />)}

      <article className="blog-article">
        {/* Breadcrumbs Nav (FR-FE-006, Section 13.4) */}
        <nav className="blog-breadcrumb" aria-label="Breadcrumb">
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            {category && (
              <li><Link href={`/blog/category/${category.slug}`}>{category.name}</Link></li>
            )}
            <li aria-current="page">{breadcrumbTitle}</li>
          </ol>
        </nav>

        {/* Header with single H1 & Byline (FR-EDT-002, FR-BLG-012) */}
        <header className="blog-header">
          <h1 className="blog-h1">{h1Title}</h1>
          <div className="blog-byline">
            <span>
              By{' '}
              {authors && authors.length > 0 ? (
                authors.map((a: any, i: number) => (
                  <span key={a.id}>
                    {i > 0 && ', '}
                    <Link href={`/blog/author/${a.slug}`}>{a.display_name}</Link>
                    {a.job_title ? `, ${a.job_title}` : ''}
                  </span>
                ))
              ) : (
                'Migration Factor Team'
              )}
            </span>
            <span>|</span>
            <span>
              Published <time dateTime={pubDateIso}>{pubDateDisplay}</time>
            </span>
            {post.show_updated_date && modDateDisplay !== pubDateDisplay && (
              <>
                <span>|</span>
                <span>
                  Updated <time dateTime={modDateIso}>{modDateDisplay}</time>
                </span>
              </>
            )}
          </div>
        </header>

        {/* Featured Image Figure (FR-MED-001, FR-MED-002) */}
        {post.featured_media_url && (
          <figure className="blog-featured-figure">
            {isOptimizableSrc(post.featured_media_url) ? (
              // Served as AVIF/WebP with a responsive srcset; priority = eager + fetchpriority high (LCP image)
              <Image
                src={post.featured_media_url}
                alt={post.featured_alt_override || post.featured_media_alt || post.title}
                width={post.featured_media_width || 1200}
                height={post.featured_media_height || 800}
                className="blog-featured-image"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            ) : (
              <img
                src={post.featured_media_url}
                alt={post.featured_alt_override || post.featured_media_alt || post.title}
                width={post.featured_media_width || 1200}
                height={post.featured_media_height || 800}
                className="blog-featured-image"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            )}
            {(post.featured_caption_override || post.featured_media_caption) && (
              <figcaption className="blog-featured-caption">
                {post.featured_caption_override || post.featured_media_caption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Body Content with semantic rendered HTML (FR-EDT-001/002/003/004/005) */}
        {quickAnswer && (
          <aside className="blog-quick-answer" aria-label="Quick answer">
            <p>
              <strong>Quick answer:</strong> {quickAnswer}
            </p>
          </aside>
        )}

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* References and Sources List (FR-GEO-002) */}
        {references && references.length > 0 && (
          <section className="blog-references" aria-labelledby="sources" style={{ marginTop: 48, paddingTop: 24, borderTop: '2px solid #e5e7eb' }}>
            <h2 id="sources" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#042628', marginBottom: 16 }}>
              Sources
            </h2>
            <ol aria-label="Sources" style={{ paddingLeft: 20, color: '#4b5563', fontSize: '0.95rem' }}>
              {references.map((ref: any, idx: number) => (
                <li key={idx} style={{ marginBottom: 10 }}>
                  <a href={ref.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0b666a', fontWeight: 600 }}>
                    {ref.title}
                  </a>
                  {ref.publisher && ` - ${ref.publisher}`}
                  {ref.published_date && ` (${ref.published_date})`}
                  {ref.note && ` - ${ref.note}`}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Author Box (FR-TAX-003, E-E-A-T) */}
        {authors && authors.length > 0 && (
          <div className="blog-authors-section" style={{ marginTop: 48 }}>
            {authors.map((author: any) => (
              <div key={author.id} className="blog-author-box">
                {author.avatar_url ? (
                  <img src={author.avatar_url} alt={author.display_name} className="blog-author-avatar" />
                ) : (
                  <div
                    className="blog-author-avatar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#0b666a',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '1.5rem',
                    }}
                  >
                    {author.display_name.charAt(0)}
                  </div>
                )}
                <div className="blog-author-meta">
                  <h3 className="blog-author-name">
                    <Link href={`/blog/author/${author.slug}`}>{author.display_name}</Link>
                  </h3>
                  {author.job_title && <div className="blog-author-title">{author.job_title}</div>}
                  <p className="blog-author-bio">{author.short_bio || author.long_bio || ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {related.length > 0 && (
          <section className="blog-related" aria-labelledby="related-articles" style={{ marginTop: 48 }}>
            <h2 id="related-articles" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#042628', marginBottom: 16 }}>
              Related articles
            </h2>
            <ul style={{ paddingLeft: 20 }}>
              {related.map((r: any) => (
                <li key={r.id} style={{ marginBottom: 8 }}>
                  <Link href={`/blog/${r.slug}`} style={{ color: '#0b666a', fontWeight: 600 }}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </div>
  );
}
