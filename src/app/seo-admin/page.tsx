import React from 'react';
import Link from 'next/link';
import { getSeoDashboardData } from '@/lib/seo-system/dashboard-service';

export const dynamic = 'force-dynamic';

export default async function SeoAdminDashboardPage() {
  const data = await getSeoDashboardData();
  const { statusCounts, scores, issues, indexingCounts, top404s, recentActivity } = data;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#042628', margin: '0 0 6px' }}>
            SEO & Editorial Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: 0 }}>
            Authoritative visibility metrics, quality scores, and crawl readiness.
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
            gap: 8,
          }}
        >
          ➕ Write New Post
        </Link>
      </div>

      {/* Row 1: Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Published', count: statusCounts.published, color: '#16a34a', status: 'published' },
          { label: 'Drafts', count: statusCounts.draft, color: '#64748b', status: 'draft' },
          { label: 'Pending Review', count: statusCounts.pending_review, color: '#ea580c', status: 'pending_review' },
          { label: 'Scheduled', count: statusCounts.scheduled, color: '#2563eb', status: 'scheduled' },
          { label: 'Unpublished', count: statusCounts.unpublished, color: '#dc2626', status: 'unpublished' },
          { label: 'Trash', count: statusCounts.trashed, color: '#94a3b8', status: 'trashed' },
        ].map((item) => (
          <Link
            key={item.label}
            href={`/seo-admin/blog?status=${item.status}`}
            style={{
              background: '#ffffff',
              padding: '16px 20px',
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              textDecoration: 'none',
              borderLeft: `4px solid ${item.color}`,
            }}
          >
            <div style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>{item.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', marginTop: 4 }}>
              {item.count}
            </div>
          </Link>
        ))}
      </div>

      {/* Row 2: Scores and Score Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
        {/* Averages Card */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            Average System Scores (Published Posts)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>SEO Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0b666a', marginTop: 4 }}>
                {scores.avgSeo || 0}<span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Readability</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                {scores.avgReadability || 0}<span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>GEO Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>
                {scores.avgGeo || 0}<span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
              </div>
            </div>
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>AEO Score</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                {scores.avgAeo || 0}<span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Score Bands Card */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            SEO Quality Distribution
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link
              href="/seo-admin/blog?score_band=80-100"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#f0fdf4',
                color: '#15803d',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <span>🟢 High Quality (80–100)</span>
              <span>{scores.bandHigh} posts</span>
            </Link>
            <Link
              href="/seo-admin/blog?score_band=50-79"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fffbeb',
                color: '#b45309',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <span>🟡 Needs Improvement (50–79)</span>
              <span>{scores.bandMed} posts</span>
            </Link>
            <Link
              href="/seo-admin/blog?score_band=0-49"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                color: '#b91c1c',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              <span>🔴 Poor / High Risk (0–49)</span>
              <span>{scores.bandLow} posts</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Row 3: SEO Issues Action Center */}
      <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
          SEO & Crawlability Issues Checklist
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {[
            { label: 'Missing Meta Description', count: issues.missingMetaDesc, filter: 'missing=meta_description', danger: issues.missingMetaDesc > 0 },
            { label: 'Missing Focus Keyword', count: issues.missingFocusKw, filter: 'missing=focus_keyword', danger: issues.missingFocusKw > 0 },
            { label: 'Missing Featured Image', count: issues.missingFeaturedImg, filter: 'missing=featured_image', danger: issues.missingFeaturedImg > 0 },
            { label: 'Non-Indexable Posts (noindex)', count: issues.nonIndexable, filter: 'robots_index=false', danger: false },
            { label: 'Orphan Posts (0 Inbound Links)', count: issues.orphanPosts, filter: 'orphans=true', danger: issues.orphanPosts > 0 },
            { label: 'Low SEO Score (< 50)', count: issues.lowSeoScore, filter: 'score_band=0-49', danger: issues.lowSeoScore > 0 },
          ].map((iss) => (
            <Link
              key={iss.label}
              href={`/seo-admin/blog?${iss.filter}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                textDecoration: 'none',
                color: '#334155',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ fontWeight: 500 }}>{iss.label}</span>
              <span
                style={{
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: iss.count > 0 ? (iss.danger ? '#fee2e2' : '#fef3c7') : '#f1f5f9',
                  color: iss.count > 0 ? (iss.danger ? '#991b1b' : '#92400e') : '#64748b',
                }}
              >
                {iss.count}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Row 4: Indexing and Technical Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Indexing Channels */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#042628', margin: '0 0 16px' }}>
            Honest Indexing Submissions (IndexNow / GSC)
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Queued</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#475569' }}>{indexingCounts.queued}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Submitted</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{indexingCounts.submitted}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Accepted</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{indexingCounts.accepted}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Failed</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{indexingCounts.failed}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
            * Statuses adhere strictly to verified evidence: Submitted → Accepted → Crawled → Indexed.
          </div>
        </div>

        {/* Top 404s */}
        <div style={{ background: '#ffffff', padding: 24, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#042628', margin: 0 }}>
              Recent 404 URLs Detected
            </h2>
            <Link href="/seo-admin/seo/redirects" style={{ fontSize: '0.75rem', color: '#0b666a', fontWeight: 600, textDecoration: 'none' }}>
              Create Redirect ↗
            </Link>
          </div>
          {top404s.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No recent 404s captured.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {top404s.map((n: any) => (
                <div key={n.path} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{n.path}</span>
                  <span style={{ fontWeight: 700, color: '#64748b' }}>{n.total_hits} hits</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
