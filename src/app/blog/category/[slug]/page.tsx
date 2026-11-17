import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { query, queryOne } from '@/lib/seo-system/db';
import { SITE_URL, resolveRedirect } from '@/lib/seo-system/technical-seo';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const cat = await queryOne<any>(`SELECT * FROM public.seo_categories WHERE slug = $1`, [slug]);
  if (!cat) return { title: 'Category Not Found' };

  const title = cat.seo_title || `${cat.name} Articles | Migration Factor`;
  const description = cat.meta_description || cat.description || `Guides, requirements and updates on ${cat.name}.`;
  const canonical = cat.canonical_url || `${SITE_URL}/blog/category/${cat.slug}`;
  const robots = cat.robots_index ? 'index, follow' : 'noindex, follow';

  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
  };
}

export default async function CategoryArchivePage(props: Props) {
  const { slug } = await props.params;

  const redirectMatch = await resolveRedirect(`/blog/category/${slug}`);
  if (redirectMatch) redirect(redirectMatch.target);

  const category = await queryOne<any>(`SELECT * FROM public.seo_categories WHERE slug = $1`, [slug]);
  if (!category) notFound();

  const posts = await query<any>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at, p.reading_time_min,
            m.url as featured_image_url, m.alt_text as featured_image_alt,
            a.display_name as author_name
     FROM public.seo_posts p
     JOIN public.seo_post_categories pc ON pc.post_id = p.id
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_post_authors pa ON pa.post_id = p.id AND pa.position = 1
     LEFT JOIN public.seo_authors a ON a.id = pa.author_id
     WHERE pc.category_id = $1 AND p.status = 'published'
     ORDER BY p.published_at DESC`,
    [category.id]
  );

  return (
    <div className="blog-page-container">
      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>

      <header style={{ marginBottom: 40, borderBottom: '1px solid #e5e7eb', paddingBottom: 24 }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#042628', marginBottom: 12 }}>
          {category.name}
        </h1>
        {category.description && (
          <p style={{ fontSize: '1.15rem', color: '#4b5563', maxWidth: 800 }}>
            {category.description}
          </p>
        )}
      </header>

      {posts.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No published articles found in this category.</p>
      ) : (
        <div className="blog-grid">
          {posts.map((post: any) => {
            const pubDate = post.published_at
              ? new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';

            return (
              <article key={post.id} className="blog-card">
                {post.featured_image_url && (
                  <Link href={`/blog/${post.slug}`}>
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
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
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
