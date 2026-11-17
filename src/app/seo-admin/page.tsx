import React from 'react';
import Link from 'next/link';
import { getSeoDashboardData } from '@/lib/seo-system/dashboard-service';

export const dynamic = 'force-dynamic';

export default async function SeoAdminDashboardPage() {
  const data = await getSeoDashboardData();
  const { statusCounts, scores, issues, indexingCounts, top404s, recentActivity } = data;

  const statusCards = [
    { label: 'Published', count: statusCounts.published, status: 'published' },
    { label: 'Drafts', count: statusCounts.draft, status: 'draft' },
    { label: 'Pending review', count: statusCounts.pending_review, status: 'pending_review' },
    { label: 'Scheduled', count: statusCounts.scheduled, status: 'scheduled' },
    { label: 'Unpublished', count: statusCounts.unpublished, status: 'unpublished' },
    { label: 'Trash', count: statusCounts.trashed, status: 'trashed' },
  ];
  const scoreCards = [
    { label: 'SEO score', value: scores.avgSeo },
    { label: 'Readability', value: scores.avgReadability },
    { label: 'GEO score', value: scores.avgGeo },
    { label: 'AEO score', value: scores.avgAeo },
  ];
  const issueRows = [
    { label: 'Missing meta description', count: issues.missingMetaDesc, filter: 'missing=meta_description', danger: issues.missingMetaDesc > 0 },
    { label: 'Missing focus keyword', count: issues.missingFocusKw, filter: 'missing=focus_keyword', danger: issues.missingFocusKw > 0 },
    { label: 'Missing featured image', count: issues.missingFeaturedImg, filter: 'missing=featured_image', danger: issues.missingFeaturedImg > 0 },
    { label: 'Non-indexable posts (noindex)', count: issues.nonIndexable, filter: 'robots_index=false', danger: false },
    { label: 'Orphan posts (0 inbound links)', count: issues.orphanPosts, filter: 'orphans=true', danger: issues.orphanPosts > 0 },
    { label: 'Low SEO score (< 50)', count: issues.lowSeoScore, filter: 'score_band=0-49', danger: issues.lowSeoScore > 0 },
  ];

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>SEO &amp; editorial dashboard</h1>
          <p>Authoritative visibility metrics, quality scores, and crawl readiness.</p>
        </div>
        <Link href="/seo-admin/blog/new" className="admin-button">Write new post</Link>
      </header>

      <div className="admin-cards">
        {statusCards.map((item) => (
          <Link key={item.label} href={`/seo-admin/blog?status=${item.status}`} className="admin-card">
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </Link>
        ))}
      </div>

      <div className="admin-panels seo-section">
        <section className="admin-panel">
          <h2>Average scores (published posts)</h2>
          <div className="seo-score-grid">
            {scoreCards.map((c) => (
              <div key={c.label} className="seo-score">
                <span>{c.label}</span>
                <strong>{c.value || 0}<small>/100</small></strong>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <h2>SEO quality distribution</h2>
          <div className="seo-band-stack">
            <Link href="/seo-admin/blog?score_band=80-100" className="seo-band seo-band-high"><span>High quality (80–100)</span><span>{scores.bandHigh} posts</span></Link>
            <Link href="/seo-admin/blog?score_band=50-79" className="seo-band seo-band-med"><span>Needs improvement (50–79)</span><span>{scores.bandMed} posts</span></Link>
            <Link href="/seo-admin/blog?score_band=0-49" className="seo-band seo-band-low"><span>Poor / high risk (0–49)</span><span>{scores.bandLow} posts</span></Link>
          </div>
        </section>
      </div>

      <section className="admin-panel seo-section">
        <h2>SEO &amp; crawlability issues</h2>
        <div className="seo-issue-grid">
          {issueRows.map((iss) => (
            <Link key={iss.label} href={`/seo-admin/blog?${iss.filter}`} className="seo-issue">
              <span>{iss.label}</span>
              <span className={`seo-pill${iss.count > 0 ? (iss.danger ? ' seo-pill-danger' : ' seo-pill-warn') : ''}`}>{iss.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="admin-panels">
        <section className="admin-panel">
          <h2>Indexing submissions (IndexNow / GSC)</h2>
          <div className="seo-metrics">
            <div><span>Queued</span><strong>{indexingCounts.queued}</strong></div>
            <div><span>Submitted</span><strong>{indexingCounts.submitted}</strong></div>
            <div><span>Accepted</span><strong>{indexingCounts.accepted}</strong></div>
            <div><span>Failed</span><strong>{indexingCounts.failed}</strong></div>
          </div>
          <p className="seo-note">Statuses follow verified evidence only: Submitted → Accepted → Crawled → Indexed.</p>
        </section>
        <section className="admin-panel">
          <div className="seo-panel-head">
            <h2>Recent 404 URLs</h2>
            <Link href="/seo-admin/seo/redirects">Create redirect ↗</Link>
          </div>
          {top404s.length === 0 ? (
            <p className="admin-empty">No recent 404s captured.</p>
          ) : (
            <div>
              {top404s.map((n: any) => (
                <div key={n.path} className="seo-kv-row">
                  <span className="seo-mono">{n.path}</span>
                  <strong>{n.total_hits} hits</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
