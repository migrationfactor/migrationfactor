import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPost } from '@/lib/seo-system/posts-service';
import { renderSeoHead } from '@/lib/seo-system/head-service';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Post Preview (Unpublished Draft) - Migration Factor',
  robots: 'noindex, nofollow',
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function PostPreviewPage(props: Props) {
  const { id } = await props.params;
  const { token } = await props.searchParams;

  const post = await getPost(id);
  if (!post) notFound();

  const headData = renderSeoHead({
    siteUrl: SITE_URL,
    siteName: 'Migration Factor',
    post,
    seo: post.seo,
    social: post.social,
    schemaConfig: post.schema,
    geoAeo: post.geo_aeo,
    featuredMedia: post.featured_media_url ? {
      url: post.featured_media_url,
      alt: post.featured_alt_override || post.featured_media_alt,
      width: post.featured_media_width,
      height: post.featured_media_height,
      caption: post.featured_caption_override || post.featured_media_caption,
    } : undefined,
    category: post.categories?.[0],
    authors: post.authors,
    isPreview: true,
  });

  const h1Title = post.seo?.custom_h1 || post.title;
  const breadcrumbTitle = post.seo?.breadcrumb_title || post.title;

  return (
    <div>
      {/* Top Preview Bar with Status and Head Inspector */}
      <div
        style={{
          background: '#042628',
          color: '#ffffff',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.875rem',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              background: '#f59e0b',
              color: '#000000',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
            }}
          >
            Draft Preview ({post.status})
          </span>
          <span style={{ fontWeight: 600 }}>{post.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            href={`/seo-admin/blog/${post.id}`}
            style={{
              background: '#0b666a',
              color: '#ffffff',
              padding: '4px 12px',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Back to Editor
          </Link>
        </div>
      </div>

      <div className="blog-page-container">
        <article className="blog-article">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/blog/">Blog</Link></li>
              {post.categories?.[0] && (
                <li><Link href={`/blog/category/${post.categories[0].slug}/`}>{post.categories[0].name}</Link></li>
              )}
              <li aria-current="page">{breadcrumbTitle}</li>
            </ol>
          </nav>

          <header className="blog-header">
            <h1 className="blog-h1">{h1Title}</h1>
            <div className="blog-byline">
              <span>
                By {post.authors?.map((a: any) => a.display_name).join(', ') || 'Migration Factor Team'}
              </span>
              <span>|</span>
              <span>Preview Mode (Unpublished)</span>
            </div>
          </header>

          {post.featured_media_url && (
            <figure className="blog-featured-figure">
              <img
                src={post.featured_media_url}
                alt={post.featured_alt_override || post.featured_media_alt || post.title}
                className="blog-featured-image"
              />
            </figure>
          )}

          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />

          {/* Collapsible SEO Head Tags Inspector */}
          <details
            style={{
              marginTop: 48,
              padding: 20,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
          >
            <summary style={{ fontWeight: 700, cursor: 'pointer', color: '#0b666a' }}>
              Inspect Rendered Server SEO Head & JSON-LD
            </summary>
            <div style={{ marginTop: 12 }}>
              <p><strong>Title:</strong> {headData.title}</p>
              <p><strong>Meta Description:</strong> {headData.metaDescription || '(None)'}</p>
              <p><strong>Canonical:</strong> {headData.canonical}</p>
              <p><strong>Robots:</strong> {headData.robots}</p>
              <div style={{ marginTop: 12 }}>
                <strong>Generated Schema JSON-LD:</strong>
                <pre style={{ background: '#1e293b', color: '#f8fafc', padding: 12, borderRadius: 6, overflowX: 'auto', marginTop: 6 }}>
                  {JSON.stringify(headData.schemaGraph, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </article>
      </div>
    </div>
  );
}
