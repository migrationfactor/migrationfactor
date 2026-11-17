import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { query, queryOne } from '@/lib/seo-system/db';
import { SITE_URL, resolveRedirect } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 12;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const pageNo = Math.max(1, parseInt((await props.searchParams).page || '1', 10) || 1);
  const tag = await queryOne<any>(`SELECT * FROM public.seo_tags WHERE slug = $1`, [slug]);
  if (!tag) return { title: 'Tag Not Found' };

  // FR-TAX-002: default to noindex if fewer than 3 published posts
  const countRes = await queryOne<{ count: string }>(
    `SELECT count(*) as count FROM public.seo_post_tags pt JOIN public.seo_posts p ON p.id = pt.post_id WHERE pt.tag_id = $1 AND p.status = 'published'`,
    [tag.id]
  );
  const count = parseInt(countRes?.count || '0', 10);
  const isIndexable = tag.robots_index && count >= 3;

  const title = tag.seo_title || `${tag.name} - Topics & Guides | Migration Factor`;
  const description = tag.meta_description || tag.description || `Articles and guides tagged with ${tag.name}.`;
  const canonical = `${SITE_URL}/blog/tag/${tag.slug}`;
  const robots = isIndexable ? 'index, follow' : 'noindex, follow';

  return {
    title,
    description,
    alternates: { canonical: pageNo > 1 ? canonical + '?page=' + pageNo : canonical },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
  };
}

export default async function TagArchivePage(props: Props) {
  const { slug } = await props.params;
  const page = Math.max(1, parseInt((await props.searchParams).page || '1', 10) || 1);

  const redirectMatch = await resolveRedirect(`/blog/tag/${slug}`);
  if (redirectMatch) redirect(redirectMatch.target);

  const tag = await queryOne<any>(`SELECT * FROM public.seo_tags WHERE slug = $1`, [slug]);
  if (!tag) notFound();

  const posts = await query<any>(
    `SELECT p.id, p.title, p.slug, p.legacy_path, p.excerpt, p.published_at, p.reading_time_min,
            m.url as featured_image_url, m.alt_text as featured_image_alt,
            a.display_name as author_name
     FROM public.seo_posts p
     JOIN public.seo_post_tags pt ON pt.post_id = p.id
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_post_authors pa ON pa.post_id = p.id AND pa.position = 1
     LEFT JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE pt.tag_id = $1 AND p.status = 'published'
     ORDER BY p.published_at DESC
     LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    [tag.id]
  );
  const totalRow = await queryOne<{ n: string }>(
    'SELECT count(*) AS n FROM public.seo_posts p JOIN public.seo_post_tags pt ON pt.post_id = p.id WHERE pt.tag_id = $1 AND p.status = ' + "'published'" + '',
    [tag.id]
  );
  const total = parseInt(totalRow?.n || '0', 10);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > lastPage) notFound();

  return (
    <div className="blog-page-container">
      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          <li aria-current="page">Tag: {tag.name}</li>
        </ol>
      </nav>

      <header style={{ marginBottom: 40, borderBottom: '1px solid #e5e7eb', paddingBottom: 24 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#042628', marginBottom: 12 }}>
          Tag: {tag.name}
        </h1>
        {tag.description && (
          <p style={{ fontSize: '1.15rem', color: '#4b5563', maxWidth: 800 }}>
            {tag.description}
          </p>
        )}
      </header>

      {posts.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No published articles found for this tag.</p>
      ) : (
        <div className="blog-grid">
          {posts.map((post: any) => {
            const pubDate = post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';

            return (
              <article key={post.id} className="blog-card">
                {post.featured_image_url && (
                  <Link href={post.legacy_path || `/blog/${post.slug}`}>
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      className="blog-card-image"
                      loading="lazy"
                    />
                  </Link>
                )}
                <div className="blog-card-body">
                  <h2 className="blog-card-title">
                    <Link href={post.legacy_path || `/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="blog-card-excerpt">{post.excerpt || ''}</p>
                  <div className="blog-card-footer">
                    <span>{post.author_name ? `By ${post.author_name}` : 'Migration Factor'}</span>
                    <span>{pubDate} · {post.reading_time_min || 3} min read</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {lastPage > 1 && (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '32px 0' }}>
          {page > 1 && <Link href={page - 1 === 1 ? '/blog/tag/' + slug : '/blog/tag/' + slug + '?page=' + (page - 1)} rel="prev">← Newer</Link>}
          <span>Page {page} of {lastPage}</span>
          {page < lastPage && <Link href={'/blog/tag/' + slug + '?page=' + (page + 1)} rel="next">Older →</Link>}
        </nav>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: tag.name, url: SITE_URL + '/blog/tag/' + slug, isPartOf: { '@type': 'WebSite', url: SITE_URL } }).replace(/</g, String.fromCharCode(92) + 'u003c') }}
      />
    </div>
  );
}
