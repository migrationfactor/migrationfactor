import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/seo-system/db';
import { SITE_URL } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog - Australian Visa & Migration Insights | Migration Factor',
  description: 'Explore Australian migration guides, employer sponsorship requirements, skilled visa updates and expert advice.',
  alternates: {
    canonical: `${SITE_URL}/blog/`,
  },
  openGraph: {
    title: 'Migration Factor Blog - Australian Immigration Guides',
    description: 'Explore Australian migration guides, employer sponsorship requirements, skilled visa updates and expert advice.',
    url: `${SITE_URL}/blog/`,
    type: 'website',
  },
};

export default async function BlogIndexPage(props: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const categorySlug = searchParams.category;
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  // Fetch categories with post count
  const categories = await query<any>(
    `SELECT c.id, c.name, c.slug, count(p.id) as post_count
     FROM public.seo_categories c
     JOIN public.seo_post_categories pc ON pc.category_id = c.id
     JOIN public.seo_posts p ON p.id = pc.post_id
     WHERE p.status = 'published'
     GROUP BY c.id, c.name, c.slug
     ORDER BY c.name ASC`
  );

  let whereExtra = '';
  const params: any[] = [];
  if (categorySlug) {
    params.push(categorySlug);
    whereExtra = `AND EXISTS (SELECT 1 FROM public.seo_post_categories pc JOIN public.seo_categories c ON c.id = pc.category_id WHERE pc.post_id = p.id AND c.slug = $1)`;
  }

  const posts = await query<any>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at, p.reading_time_min,
            m.url as featured_image_url, m.alt_text as featured_image_alt,
            c.name as category_name, c.slug as category_slug,
            a.display_name as author_name, a.slug as author_slug
     FROM public.seo_posts p
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_categories c ON c.id = p.primary_category_id
     LEFT JOIN public.seo_post_authors pa ON pa.post_id = p.id AND pa.position = 1
     LEFT JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE p.status = 'published' ${whereExtra}
     ORDER BY p.published_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return (
    <div className="blog-page-container">
      <header style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.75rem', fontWeight: 800, color: '#042628', marginBottom: 12 }}>
          Migration & Visa Insights
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#4b5563', maxWidth: 700, margin: '0 auto' }}>
          Up-to-date guidance, legal requirements, and practical advice on Australian skilled visas, sponsorship, and permanent residency.
        </p>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <Link
            href="/blog/"
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
              backgroundColor: !categorySlug ? '#0b666a' : '#f3f4f6',
              color: !categorySlug ? '#ffffff' : '#4b5563',
            }}
          >
            All Articles
          </Link>
          {categories.map((c: any) => (
            <Link
              key={c.id}
              href={`/blog/category/${c.slug}/`}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: '0.875rem',
                fontWeight: 600,
                textDecoration: 'none',
                backgroundColor: categorySlug === c.slug ? '#0b666a' : '#f3f4f6',
                color: categorySlug === c.slug ? '#ffffff' : '#4b5563',
              }}
            >
              {c.name} ({c.post_count})
            </Link>
          ))}
        </div>
      </header>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
          <p style={{ fontSize: '1.1rem' }}>No articles published in this category yet. Check back soon!</p>
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((post: any) => {
            const pubDate = post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';

            return (
              <article key={post.id} className="blog-card">
                {post.featured_image_url && (
                  <Link href={`/blog/${post.slug}/`}>
                    <img
                      src={post.featured_image_url}
                      alt={post.featured_image_alt || post.title}
                      className="blog-card-image"
                      loading="lazy"
                    />
                  </Link>
                )}
                <div className="blog-card-body">
                  {post.category_name && (
                    <div className="blog-card-category">{post.category_name}</div>
                  )}
                  <h2 className="blog-card-title">
                    <Link href={`/blog/${post.slug}/`}>{post.title}</Link>
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
    </div>
  );
}
