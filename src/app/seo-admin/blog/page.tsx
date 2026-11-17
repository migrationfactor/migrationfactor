import React from 'react';
import Link from 'next/link';
import { listPosts } from '@/lib/seo-system/posts-service';
import { listCategories, listAuthors } from '@/lib/seo-system/taxonomies-service';
import BulkToolbar from '@/components/seo-admin/BulkToolbar';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    status?: string;
    category_id?: string;
    author_id?: string;
    score_band?: string;
    missing?: string;
    robots_index?: string;
    orphans?: string;
    q?: string;
    page?: string;
  }>;
}

export default async function AllPostsPage(props: Props) {
  const params = await props.searchParams;
  const currentStatus = params.status || 'all';
  const categoryId = params.category_id;
  const authorId = params.author_id;
  const scoreBand = params.score_band as any;
  const missing = params.missing as any;
  const robotsIndex = params.robots_index !== undefined ? params.robots_index === 'true' : undefined;
  const search = params.q;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { posts, total, statusCounts } = await listPosts({
    status: currentStatus,
    categoryId,
    authorId,
    scoreBand,
    missing,
    robotsIndex,
    orphans: params.orphans === 'true',
    search,
    limit,
    offset,
  });

  const categories = await listCategories();
  const authors = await listAuthors();

  return (
    <div style={{ maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
            All Blog Posts
          </h1>
          <p style={{ color: '#3d5557', fontSize: '0.875rem', margin: 0 }}>
            Manage articles, SEO snippet optimizations, schema and publication status.
          </p>
        </div>
        <Link
          href="/seo-admin/blog/new"
          style={{
            padding: '10px 18px',
            backgroundColor: '#0b666a',
            color: '#ffffff',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ➕ Add New Post
        </Link>
      </div>

      {/* Status Tabs (FR-BLG-013) */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #b9d3d4', marginBottom: 20, overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All', count: statusCounts.all },
          { id: 'published', label: 'Published', count: statusCounts.published },
          { id: 'draft', label: 'Drafts', count: statusCounts.draft },
          { id: 'pending_review', label: 'Pending', count: statusCounts.pending_review },
          { id: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled },
          { id: 'unpublished', label: 'Unpublished', count: statusCounts.unpublished },
          { id: 'trashed', label: 'Trash', count: statusCounts.trashed },
        ].map((tab) => {
          const isActive = currentStatus === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/seo-admin/blog?status=${tab.id}`}
              style={{
                padding: '8px 14px',
                fontSize: '0.875rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0b666a' : '#3d5557',
                borderBottom: isActive ? '3px solid #0b666a' : '3px solid transparent',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  borderRadius: 10,
                  backgroundColor: isActive ? '#d4efec' : '#e9f3f3',
                  color: isActive ? '#07484b' : '#3d5557',
                }}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Filter Bar */}
      <form
        method="GET"
        action="/seo-admin/blog"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          padding: 16,
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #cfe3e3',
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        <input type="hidden" name="status" value={currentStatus} />

        {/* Search Input */}
        <input
          type="text"
          name="q"
          placeholder="Search by title, keyword, slug..."
          defaultValue={search || ''}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #b9d3d4',
            fontSize: '0.875rem',
            width: 240,
          }}
        />

        {/* Category Filter */}
        <select
          name="category_id"
          defaultValue={categoryId || ''}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #b9d3d4',
            fontSize: '0.875rem',
            background: '#ffffff',
          }}
        >
          <option value="">All Categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Score Band Filter */}
        <select
          name="score_band"
          defaultValue={scoreBand || ''}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #b9d3d4',
            fontSize: '0.875rem',
            background: '#ffffff',
          }}
        >
          <option value="">All SEO Scores</option>
          <option value="80-100">🟢 High (80–100)</option>
          <option value="50-79">🟡 Fair (50–79)</option>
          <option value="0-49">🔴 Poor (0–49)</option>
          <option value="not_analyzed">⚪ Not Analyzed</option>
        </select>

        {/* Missing Issues Filter */}
        <select
          name="missing"
          defaultValue={missing || ''}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #b9d3d4',
            fontSize: '0.875rem',
            background: '#ffffff',
          }}
        >
          <option value="">All Quality Status</option>
          <option value="focus_keyword">Missing Focus Keyword</option>
          <option value="meta_description">Missing Meta Description</option>
          <option value="featured_image">Missing Featured Image</option>
        </select>

        <select name="author_id" defaultValue={authorId || ''} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', background: '#ffffff' }}>
          <option value="">All Authors</option>
          {authors.map((a: any) => (
            <option key={a.id} value={a.id}>{a.display_name}</option>
          ))}
        </select>

        <select name="robots_index" defaultValue={params.robots_index || ''} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #b9d3d4', fontSize: '0.875rem', background: '#ffffff' }}>
          <option value="">Index + noindex</option>
          <option value="true">Indexable only</option>
          <option value="false">Noindex only</option>
        </select>

        <button
          type="submit"
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            backgroundColor: '#042628',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Apply Filters
        </button>

        {(search || categoryId || authorId || scoreBand || missing || params.robots_index) && (
          <Link
            href={`/seo-admin/blog?status=${currentStatus}`}
            style={{ fontSize: '0.8125rem', color: '#a01b2b', textDecoration: 'none', marginLeft: 8 }}
          >
            Clear Filters
          </Link>
        )}
      </form>

      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <a href={'/api/v1/posts/export?' + new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString()} style={{ fontSize: '0.8125rem', color: '#0b666a', fontWeight: 600 }}>Export CSV ↓</a>
      </div>
      <BulkToolbar />

      {/* Posts Table */}
      <div style={{ background: '#ffffff', borderRadius: 8, border: '1px solid #cfe3e3', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f2f8f8', borderBottom: '2px solid #cfe3e3', color: '#3d5557' }}>
              <th style={{ padding: '12px 10px', width: 28 }} aria-label="Select"></th>
              <th style={{ padding: '12px 16px' }}>Title & Slug</th>
              <th style={{ padding: '12px 14px' }}>Focus Keyword</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>SEO Score</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Readability</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>GEO / AEO</th>
              <th style={{ padding: '12px 14px' }}>Status</th>
              <th style={{ padding: '12px 14px' }}>Date</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#6b8183' }}>
                  No posts match your filters.
                </td>
              </tr>
            ) : (
              posts.map((post: any) => {
                const seoScore = post.seo_score;
                let badgeBg = '#e9f3f3';
                let badgeColor = '#3d5557';
                if (seoScore !== null && seoScore !== undefined) {
                  if (seoScore >= 80) {
                    badgeBg = '#d4efec';
                    badgeColor = '#07484b';
                  } else if (seoScore >= 50) {
                    badgeBg = '#f4ecd2';
                    badgeColor = '#8a5a00';
                  } else {
                    badgeBg = '#f1e4e4';
                    badgeColor = '#a01b2b';
                  }
                }

                return (
                  <tr key={post.id} style={{ borderBottom: '1px solid #e9f3f3', verticalAlign: 'middle' }}>
                    <td style={{ padding: '14px 10px' }}>
                      <input type="checkbox" name="sel" value={post.id} aria-label={`Select ${post.title}`} />
                    </td>
                    {/* Title & Slug */}
                    <td style={{ padding: '14px 16px', maxWidth: 320 }}>
                      <Link
                        href={`/seo-admin/blog/${post.id}`}
                        style={{ fontWeight: 700, color: '#042628', textDecoration: 'none', fontSize: '0.925rem' }}
                      >
                        {post.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: '#6b8183', marginTop: 2, fontFamily: 'monospace' }}>
                        {post.legacy_path || `/blog/${post.slug}/`}
                      </div>
                    </td>

                    {/* Focus Keyword */}
                    <td style={{ padding: '14px 14px' }}>
                      {post.focus_keyword ? (
                        <span style={{ fontWeight: 600, color: '#0b666a', background: '#e9f3f3', padding: '2px 8px', borderRadius: 4, border: '1px solid #d4efec' }}>
                          {post.focus_keyword}
                        </span>
                      ) : (
                        <span style={{ color: '#b4424f', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>
                      )}
                    </td>

                    {/* SEO Score */}
                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      {seoScore !== null && seoScore !== undefined ? (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            backgroundColor: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {seoScore}
                        </span>
                      ) : (
                        <span style={{ color: '#b9d3d4' }}>—</span>
                      )}
                    </td>

                    {/* Readability */}
                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#042628' }}>
                        {post.seo_readability || '—'}
                      </span>
                    </td>

                    {/* GEO / AEO */}
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#07484b', fontWeight: 600 }}>G: {post.geo_score || '—'}</span>
                      {' · '}
                      <span style={{ color: '#0b666a', fontWeight: 600 }}>A: {post.aeo_score || '—'}</span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor:
                            post.status === 'published' ? '#d4efec' :
                            post.status === 'scheduled' ? '#dbeafe' :
                            post.status === 'pending_review' ? '#ffedd5' :
                            post.status === 'trashed' ? '#f1e4e4' : '#e9f3f3',
                          color:
                            post.status === 'published' ? '#0b666a' :
                            post.status === 'scheduled' ? '#0b666a' :
                            post.status === 'pending_review' ? '#b4424f' :
                            post.status === 'trashed' ? '#a01b2b' : '#3d5557',
                        }}
                      >
                        {post.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 14px', color: '#3d5557', fontSize: '0.8125rem' }}>
                      {post.published_at ? new Date(post.published_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : 'Unpublished'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <Link
                          href={`/seo-admin/blog/${post.id}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: '#0b666a',
                            color: '#ffffff',
                            fontWeight: 600,
                            textDecoration: 'none',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Edit
                        </Link>
                        {post.status === 'published' ? (
                          <Link
                            href={post.legacy_path || `/blog/${post.slug}/`}
                            target="_blank"
                            style={{ color: '#3d5557', textDecoration: 'none', fontSize: '0.8125rem' }}
                          >
                            View ↗
                          </Link>
                        ) : (
                          <Link
                            href={`/preview/${post.id}`}
                            target="_blank"
                            style={{ color: '#0b666a', textDecoration: 'none', fontSize: '0.8125rem' }}
                          >
                            Preview ↗
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {total > limit && (() => {
        const last = Math.ceil(total / limit);
        const qs = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== 'page') as [string, string][]);
        const href = (n: number) => `/seo-admin/blog?${qs.toString()}${qs.toString() ? '&' : ''}page=${n}`;
        return (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16, fontSize: '0.85rem' }}>
            {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span style={{ color: '#9db8b9' }}>← Previous</span>}
            <span>Page {page} of {last} · {total} posts</span>
            {page < last ? <Link href={href(page + 1)}>Next →</Link> : <span style={{ color: '#9db8b9' }}>Next →</span>}
          </div>
        );
      })()}
    </div>
  );
}
