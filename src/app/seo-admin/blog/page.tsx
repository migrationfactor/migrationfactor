import React from 'react';
import Link from 'next/link';
import { listPosts } from '@/lib/seo-system/posts-service';
import { listCategories, listAuthors } from '@/lib/seo-system/taxonomies-service';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    status?: string;
    category_id?: string;
    author_id?: string;
    score_band?: string;
    missing?: string;
    robots_index?: string;
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
  const page = parseInt(params.page || '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { posts, total, statusCounts } = await listPosts({
    status: currentStatus,
    categoryId,
    authorId,
    scoreBand,
    missing,
    robotsIndex,
    search,
    limit,
    offset,
  });

  const categories = await listCategories();
  const authors = await listAuthors();

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>
            All Blog Posts
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
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
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #cbd5e1', marginBottom: 20, overflowX: 'auto' }}>
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
                color: isActive ? '#0b666a' : '#64748b',
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
                  backgroundColor: isActive ? '#ccfbf1' : '#f1f5f9',
                  color: isActive ? '#0f766e' : '#64748b',
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
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
            border: '1px solid #cbd5e1',
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
            border: '1px solid #cbd5e1',
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
            border: '1px solid #cbd5e1',
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
            border: '1px solid #cbd5e1',
            fontSize: '0.875rem',
            background: '#ffffff',
          }}
        >
          <option value="">All Quality Status</option>
          <option value="focus_keyword">Missing Focus Keyword</option>
          <option value="meta_description">Missing Meta Description</option>
          <option value="featured_image">Missing Featured Image</option>
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

        {(search || categoryId || scoreBand || missing) && (
          <Link
            href={`/seo-admin/blog?status=${currentStatus}`}
            style={{ fontSize: '0.8125rem', color: '#dc2626', textDecoration: 'none', marginLeft: 8 }}
          >
            Clear Filters
          </Link>
        )}
      </form>

      {/* Posts Table */}
      <div style={{ background: '#ffffff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
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
                <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
                  No posts match your filters.
                </td>
              </tr>
            ) : (
              posts.map((post: any) => {
                const seoScore = post.seo_score;
                let badgeBg = '#f1f5f9';
                let badgeColor = '#64748b';
                if (seoScore !== null && seoScore !== undefined) {
                  if (seoScore >= 80) {
                    badgeBg = '#dcfce7';
                    badgeColor = '#15803d';
                  } else if (seoScore >= 50) {
                    badgeBg = '#fef3c7';
                    badgeColor = '#b45309';
                  } else {
                    badgeBg = '#fee2e2';
                    badgeColor = '#b91c1c';
                  }
                }

                return (
                  <tr key={post.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                    {/* Title & Slug */}
                    <td style={{ padding: '14px 16px', maxWidth: 320 }}>
                      <Link
                        href={`/seo-admin/blog/${post.id}`}
                        style={{ fontWeight: 700, color: '#042628', textDecoration: 'none', fontSize: '0.925rem' }}
                      >
                        {post.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>
                        /blog/{post.slug}/
                      </div>
                    </td>

                    {/* Focus Keyword */}
                    <td style={{ padding: '14px 14px' }}>
                      {post.focus_keyword ? (
                        <span style={{ fontWeight: 600, color: '#0b666a', background: '#f0fdfa', padding: '2px 8px', borderRadius: 4, border: '1px solid #ccfbf1' }}>
                          {post.focus_keyword}
                        </span>
                      ) : (
                        <span style={{ color: '#f87171', fontSize: '0.8rem', fontStyle: 'italic' }}>None</span>
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
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>

                    {/* Readability */}
                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {post.seo_readability || '—'}
                      </span>
                    </td>

                    {/* GEO / AEO */}
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontSize: '0.8125rem' }}>
                      <span style={{ color: '#7c3aed', fontWeight: 600 }}>G: {post.geo_score || '—'}</span>
                      {' · '}
                      <span style={{ color: '#059669', fontWeight: 600 }}>A: {post.aeo_score || '—'}</span>
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
                            post.status === 'published' ? '#dcfce7' :
                            post.status === 'scheduled' ? '#dbeafe' :
                            post.status === 'pending_review' ? '#ffedd5' :
                            post.status === 'trashed' ? '#fee2e2' : '#f1f5f9',
                          color:
                            post.status === 'published' ? '#16a34a' :
                            post.status === 'scheduled' ? '#2563eb' :
                            post.status === 'pending_review' ? '#ea580c' :
                            post.status === 'trashed' ? '#dc2626' : '#64748b',
                        }}
                      >
                        {post.status}
                      </span>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 14px', color: '#64748b', fontSize: '0.8125rem' }}>
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
                            href={`/blog/${post.slug}/`}
                            target="_blank"
                            style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8125rem' }}
                          >
                            View ↗
                          </Link>
                        ) : (
                          <Link
                            href={`/preview/${post.id}`}
                            target="_blank"
                            style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}
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
    </div>
  );
}
