import React from 'react';
import Link from 'next/link';
import { getSeoDashboardData } from '@/lib/seo-system/dashboard-service';
import { backfillAllMissing } from '@/lib/seo-system/analysis-service';

export const dynamic = 'force-dynamic';

export default async function SeoAdminDashboardPage() {
  await backfillAllMissing().catch(() => 0);
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
    { label: 'Low SEO score (below 60)', count: issues.lowSeoScore, filter: 'score_band=0-59', danger: issues.lowSeoScore > 0 },
  ];

  return (
    <>
      <h1 className="wp-heading-inline">Dashboard</h1>
      <hr className="wp-header-end" />

      <div className="sa-widgets">
        <section className="postbox">
          <h2 className="postbox-title">At a Glance</h2>
          <div className="inside">
            <ul className="sa-glance">
              {statusCards.map((item) => (
                <li key={item.label}>
                  <Link href={`/seo-admin/blog?status=${item.status}`}><b>{item.count}</b> {item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="postbox">
          <h2 className="postbox-title">Average Scores (Published Posts)</h2>
          <div className="inside">
            <div className="sa-score-grid">
              {scoreCards.map((c) => (
                <div key={c.label} className="sa-score">
                  <span>{c.label}</span>
                  <strong>{c.value || 0}<small>/100</small></strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="postbox">
          <h2 className="postbox-title">SEO Quality Distribution</h2>
          <div className="inside">
            <ul className="sa-bands">
              <li className="sa-band-high"><Link href="/seo-admin/blog?score_band=80-100"><span>High quality (80–100)</span><b>{scores.bandHigh}</b></Link></li>
              <li className="sa-band-med"><Link href="/seo-admin/blog?score_band=60-79"><span>Needs improvement (60–79)</span><b>{scores.bandMed}</b></Link></li>
              <li className="sa-band-low"><Link href="/seo-admin/blog?score_band=0-59"><span>Poor (below 60)</span><b>{scores.bandLow}</b></Link></li>
            </ul>
          </div>
        </section>

        <section className="postbox">
          <h2 className="postbox-title">Indexing Submissions (IndexNow / GSC)</h2>
          <div className="inside">
            <div className="sa-metrics">
              <div><span>Queued</span><strong>{indexingCounts.queued}</strong></div>
              <div><span>Submitted</span><strong>{indexingCounts.submitted}</strong></div>
              <div><span>Accepted</span><strong>{indexingCounts.accepted}</strong></div>
              <div><span>Failed</span><strong>{indexingCounts.failed}</strong></div>
            </div>
            <p className="description">Statuses follow verified evidence only: Submitted → Accepted → Crawled → Indexed.</p>
          </div>
        </section>

        <section className="postbox sa-widget-wide">
          <h2 className="postbox-title">SEO &amp; Crawlability Issues</h2>
          <div className="inside">
            <ul className="sa-issues">
              {issueRows.map((iss) => (
                <li key={iss.label}>
                  <Link href={`/seo-admin/blog?${iss.filter}`}>
                    <span>{iss.label}</span>
                    <b className={iss.count > 0 ? (iss.danger ? 'is-danger' : 'is-warn') : undefined}>{iss.count}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="postbox">
          <h2 className="postbox-title">Recent 404 URLs</h2>
          <div className="inside">
            {top404s.length === 0 ? (
              <p className="description">No recent 404s captured.</p>
            ) : (
              <ul className="sa-kv">
                {top404s.map((n: any) => (
                  <li key={n.path}><code>{n.path}</code><b>{n.total_hits} hits</b></li>
                ))}
              </ul>
            )}
            <p><Link href="/seo-admin/seo/redirects">Create a redirect →</Link></p>
          </div>
        </section>
      </div>
    </>
  );
}
