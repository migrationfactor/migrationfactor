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
  const author = await queryOne<any>(`SELECT * FROM public.seo_authors WHERE slug = $1`, [slug]);
  if (!author) return { title: 'Author Not Found' };

  const title = `${author.display_name} - Registered Migration Specialist | Migration Factor`;
  const description = author.short_bio || `Articles, insights and visa pathway guides written by ${author.display_name}.`;
  const canonical = `${SITE_URL}/blog/author/${author.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: 'index, follow',
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'profile',
      images: author.avatar_url ? [{ url: author.avatar_url }] : [],
    },
  };
}

export default async function AuthorProfilePage(props: Props) {
  const { slug } = await props.params;

  const redirectMatch = await resolveRedirect(`/blog/author/${slug}`);
  if (redirectMatch) redirect(redirectMatch.target);

  const author = await queryOne<any>(`SELECT * FROM public.seo_authors WHERE slug = $1`, [slug]);
  if (!author) notFound();

  const posts = await query<any>(
    `SELECT p.id, p.title, p.slug, p.legacy_path, p.excerpt, p.published_at, p.reading_time_min,
            m.url as featured_image_url, m.alt_text as featured_image_alt,
            c.name as category_name
     FROM public.seo_posts p
     JOIN public.seo_post_authors pa ON pa.post_id = p.id
     LEFT JOIN public.seo_media m ON m.id = p.featured_media_id
     LEFT JOIN public.seo_categories c ON c.id = p.primary_category_id
     WHERE pa.author_id = $1 AND p.status = 'published'
     ORDER BY p.published_at DESC`,
    [author.id]
  );

  const authorUrl = `${SITE_URL}/blog/author/${author.slug}`;
  const credentials = Array.isArray(author.credentials) ? author.credentials : [];
  const sameAs = Array.isArray(author.same_as) ? author.same_as : [];

  // JSON-LD Profile Schema
  const authorSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${authorUrl}#webpage`,
    url: authorUrl,
    name: `${author.display_name} Profile`,
    mainEntity: {
      '@type': 'Person',
      '@id': `${authorUrl}#person`,
      name: author.display_name,
      jobTitle: author.job_title || 'Registered Migration Specialist',
      description: author.short_bio || author.long_bio || '',
      url: authorUrl,
      sameAs,
      worksFor: {
        '@type': 'Organization',
        name: 'Migration Factor',
        url: `${SITE_URL}/`,
      },
    },
  };

  return (
    <div className="blog-page-container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
      />

      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/blog">Blog</Link></li>
          <li aria-current="page">{author.display_name}</li>
        </ol>
      </nav>

      {/* Author Profile Bio Card (FR-TAX-003, E-E-A-T) */}
      <header className="blog-author-box" style={{ background: '#ffffff', border: '1px solid #d1d5db', padding: 32 }}>
        {author.avatar_url ? (
          <img
            src={author.avatar_url}
            alt={author.display_name}
            style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid #35b5ac' }}
          />
        ) : (
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: '#0b666a',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {author.display_name.charAt(0)}
          </div>
        )}

        <div style={{ flex: 1, paddingLeft: 16 }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#042628', margin: '0 0 6px' }}>
            {author.display_name}
          </h1>
          {author.job_title && (
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0b666a', marginBottom: 12 }}>
              {author.job_title}
            </div>
          )}
          <p style={{ fontSize: '1rem', color: '#4b5563', lineHeight: 1.6, margin: '0 0 16px' }}>
            {author.long_bio || author.short_bio || ''}
          </p>

          {/* Credentials */}
          {credentials.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: '0.875rem', color: '#042628' }}>Credentials & Qualifications:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: '0.875rem', color: '#4b5563' }}>
                {credentials.map((cred: any, idx: number) => (
                  <li key={idx}>
                    <strong>{cred.name}</strong> - {cred.issuingBody} {cred.year ? `(${cred.year})` : ''}
                    {cred.verificationUrl && (
                      <a href={cred.verificationUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: '#0b666a' }}>
                        [Verify]
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Social and registry profiles */}
          {sameAs.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
              {sameAs.map((url: string, idx: number) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.8125rem',
                    color: '#0b666a',
                    padding: '4px 10px',
                    backgroundColor: '#f0fdfa',
                    borderRadius: 6,
                    border: '1px solid #ccfbf1',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  {url.includes('linkedin') ? 'LinkedIn' : url.includes('twitter') || url.includes('x.com') ? 'X' : 'Professional Profile'}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Articles by this author */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#042628', marginBottom: 20 }}>
          Articles by {author.display_name} ({posts.length})
        </h2>

        {posts.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No published articles yet.</p>
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
                    {post.category_name && (
                      <div className="blog-card-category">{post.category_name}</div>
                    )}
                    <h3 className="blog-card-title">
                      <Link href={post.legacy_path || `/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p className="blog-card-excerpt">{post.excerpt || ''}</p>
                    <div className="blog-card-footer">
                      <span>{pubDate}</span>
                      <span>{post.reading_time_min || 3} min read</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
