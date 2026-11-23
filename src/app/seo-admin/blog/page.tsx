import React from 'react';
import Link from 'next/link';
import { listPosts } from '@/lib/seo-system/posts-service';
import { listCategories } from '@/lib/seo-system/taxonomies-service';
import { verifySeoSession } from '@/lib/seo-system/auth';
import BulkToolbar from '@/components/seo-admin/BulkToolbar';
import { backfillMissing } from '@/lib/seo-system/analysis-service';
import PostRowActions from '@/components/seo-admin/PostRowActions';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

const blue = '#3858e9';
const field: React.CSSProperties = { width: 'auto', maxWidth: 220, minHeight: 30, border: '1px solid #8c8f94', borderRadius: 3, padding: '0 8px', fontSize: 14, background: '#fff', color: '#2c3338' };
const btn: React.CSSProperties = { padding: '0 10px', lineHeight: '28px', minHeight: 30, border: `1px solid ${blue}`, borderRadius: 3, background: '#f6f7f7', color: blue, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };

const SEO_FILTERS: Array<[string, string]> = [
  ['', 'Rank Math'],
  ['score:80-100', 'SEO Score: Good (80–100)'],
  ['score:50-79', 'SEO Score: OK (50–79)'],
  ['score:0-49', 'SEO Score: Bad (0–49)'],
  ['score:not_analyzed', 'SEO Score: No Data'],
  ['noindex', 'Noindex posts'],
  ['missing:focus_keyword', 'Missing focus keyword'],
  ['missing:meta_description', 'Missing meta description'],
  ['missing:featured_image', 'Missing featured image'],
  ['orphans', 'Orphan posts'],
];

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function AllPostsPage(props: Props) {
  const params = await props.searchParams;
  const session = await verifySeoSession();
  const userId = session?.user?.id;

  const status = params.status || 'all';
  const mine = params.mine === '1';
  const pillar = params.pillar === '1';
  const search = params.q || '';
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = 20;
  const sortBy = params.orderby === 'title' ? 'title' : 'created_at';
  const sortOrder = params.order === 'asc' ? 'asc' : 'desc';

  // The single "Rank Math" select maps onto the individual filters (the dashboard links use the long form).
  let scoreBand = params.score_band as any;
  let missing = params.missing as any;
  let robotsIndex = params.robots_index !== undefined ? params.robots_index === 'true' : undefined;
  let orphans = params.orphans === 'true';
  const seo = params.seo || '';
  if (seo.startsWith('score:')) scoreBand = seo.slice(6);
  else if (seo.startsWith('missing:')) missing = seo.slice(8);
  else if (seo === 'noindex') robotsIndex = false;
  else if (seo === 'orphans') orphans = true;

  const listArgs = {
    status: mine || pillar ? 'all' : status,
    categoryId: params.category_id,
    authorId: params.author_id,
    scoreBand,
    missing,
    robotsIndex,
    orphans,
    createdBy: mine ? userId : undefined,
    pillar,
    month: params.m,
    currentUserId: userId,
    search: search || undefined,
    sortBy: sortBy as any,
    sortOrder,
    limit,
    offset: (page - 1) * limit,
  } as Parameters<typeof listPosts>[0];
  let data = await listPosts(listArgs);
  // Posts that were imported or created before they were ever saved in the editor have no stored score or link graph yet.
  const unscored = data.posts.filter((p: any) => p.seo_score === null || p.seo_score === undefined || Number(p.links_internal) + Number(p.links_external) === 0).map((p: any) => p.id);
  if (unscored.length && (await backfillMissing(unscored))) data = await listPosts(listArgs);
  const { posts, total, statusCounts, mineCount, pillarCount, months } = data;
  const categories = await listCategories();
  const lastPage = Math.max(1, Math.ceil(total / limit));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return `/seo-admin/blog${s ? `?${s}` : ''}`;
  };

  const views: Array<{ id: string; label: string; count: number; href: string; active: boolean; hide?: boolean }> = [
    { id: 'all', label: 'All', count: statusCounts.all, href: '/seo-admin/blog', active: !mine && !pillar && status === 'all' },
    { id: 'mine', label: 'Mine', count: mineCount, href: '/seo-admin/blog?mine=1', active: mine },
    { id: 'published', label: 'Published', count: statusCounts.published, href: '/seo-admin/blog?status=published', active: !mine && !pillar && status === 'published' },
    { id: 'draft', label: 'Drafts', count: statusCounts.draft, href: '/seo-admin/blog?status=draft', active: !mine && !pillar && status === 'draft' },
    { id: 'pending_review', label: 'Pending', count: statusCounts.pending_review, href: '/seo-admin/blog?status=pending_review', active: status === 'pending_review', hide: statusCounts.pending_review === 0 },
    { id: 'scheduled', label: 'Scheduled', count: statusCounts.scheduled, href: '/seo-admin/blog?status=scheduled', active: status === 'scheduled', hide: statusCounts.scheduled === 0 },
    { id: 'unpublished', label: 'Unpublished', count: statusCounts.unpublished, href: '/seo-admin/blog?status=unpublished', active: status === 'unpublished', hide: statusCounts.unpublished === 0 },
    { id: 'pillar', label: 'Pillar Content', count: pillarCount, href: '/seo-admin/blog?pillar=1', active: pillar },
    { id: 'trashed', label: 'Trash', count: statusCounts.trashed, href: '/seo-admin/blog?status=trashed', active: status === 'trashed', hide: statusCounts.trashed === 0 },
  ].filter((v) => !v.hide);

  const badge = (score: number | null | undefined) => {
    if (score === null || score === undefined) return <span style={{ color: '#787c82' }}>—</span>;
    const bg = score >= 80 ? '#4ab866' : score >= 50 ? '#f0b849' : '#e65054';
    return <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 3, background: bg, color: '#fff', fontWeight: 600, fontSize: 14, lineHeight: 1 }}>{score} / 100</span>;
  };

  const pager = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#50575e' }}>
      <span style={{ marginRight: 6 }}>{total} {total === 1 ? 'item' : 'items'}</span>
      {lastPage > 1 && (
        <>
          {page > 1 ? <Link href={qs({ page: '1' })} aria-label="First page" style={{ ...btn, color: blue }}>«</Link> : <span style={{ ...btn, color: '#a7aaad', borderColor: '#dcdcde', cursor: 'default' }}>«</span>}
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} aria-label="Previous page" style={btn}>‹</Link> : <span style={{ ...btn, color: '#a7aaad', borderColor: '#dcdcde', cursor: 'default' }}>‹</span>}
          <form method="GET" action="/seo-admin/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {Object.entries(params).filter(([k, v]) => v && k !== 'page').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="number" name="page" min={1} max={lastPage} defaultValue={page} aria-label="Current Page" style={{ ...field, width: 52, textAlign: 'center' }} />
            <span>of {lastPage}</span>
          </form>
          {page < lastPage ? <Link href={qs({ page: String(page + 1) })} aria-label="Next page" style={btn}>›</Link> : <span style={{ ...btn, color: '#a7aaad', borderColor: '#dcdcde', cursor: 'default' }}>›</span>}
          {page < lastPage ? <Link href={qs({ page: String(lastPage) })} aria-label="Last page" style={btn}>»</Link> : <span style={{ ...btn, color: '#a7aaad', borderColor: '#dcdcde', cursor: 'default' }}>»</span>}
        </>
      )}
    </div>
  );

  const titleSortHref = qs({ orderby: 'title', order: sortBy === 'title' && sortOrder === 'asc' ? 'desc' : 'asc', page: undefined });

  return (
    <div style={{ maxWidth: 1600, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#1d2327' }}>
      <style>{`.wp-rowactions{visibility:hidden;font-size:13px;padding-top:2px;color:#a7aaad}tr:hover .wp-rowactions,.wp-rowactions:focus-within{visibility:visible}`}</style>
      <h1 style={{ fontSize: 23, fontWeight: 400, margin: '0 0 16px', padding: '9px 0 4px', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 12 }}>
        Posts
        <Link href="/seo-admin/blog/new" style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', border: `1px solid ${blue}`, borderRadius: 3, color: blue, textDecoration: 'none', background: '#f6f7f7', lineHeight: 1.6 }}>Add Post</Link>
      </h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, margin: '18px 0 10px' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13, display: 'flex', flexWrap: 'wrap', color: '#a7aaad' }}>
          {views.map((v, i) => (
            <li key={v.id}>
              <Link href={v.href} aria-current={v.active ? 'page' : undefined} style={{ color: v.active ? '#000' : blue, fontWeight: v.active ? 600 : 400, textDecoration: 'none' }}>{v.label}</Link>{' '}
              <span style={{ color: '#50575e' }}>({v.count})</span>
              {i < views.length - 1 && <span style={{ margin: '0 6px' }}>|</span>}
            </li>
          ))}
        </ul>
        <form method="GET" action="/seo-admin/blog" role="search" style={{ display: 'flex', gap: 6 }}>
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {mine && <input type="hidden" name="mine" value="1" />}
          {pillar && <input type="hidden" name="pillar" value="1" />}
          <input type="search" name="q" defaultValue={search} aria-label="Search Posts" style={{ ...field, width: 220 }} />
          <button type="submit" style={btn}>Search Posts</button>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '8px 0' }}>
        <form method="GET" action="/seo-admin/blog" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <BulkToolbar position="top" />
          {status !== 'all' && <input type="hidden" name="status" value={status} />}
          {mine && <input type="hidden" name="mine" value="1" />}
          {pillar && <input type="hidden" name="pillar" value="1" />}
          {search && <input type="hidden" name="q" value={search} />}
          <select name="m" defaultValue={params.m || ''} aria-label="Filter by date" style={field}>
            <option value="">All dates</option>
            {months.map((m: string) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select name="category_id" defaultValue={params.category_id || ''} aria-label="Filter by category" style={field}>
            <option value="">All Categories</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select name="seo" defaultValue={seo} aria-label="Filter by SEO" style={field}>
            {SEO_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="submit" style={btn}>Filter</button>
        </form>
        {pager}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #c3c4c7', boxShadow: '0 1px 1px rgba(0,0,0,.04)', fontSize: 13, tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #c3c4c7' }}>
            <td style={{ width: 36, padding: '12px 0 12px 12px' }}><input type="checkbox" data-select-all aria-label="Select All" /></td>
            <th scope="col" style={{ textAlign: 'left', padding: '12px 10px', fontWeight: 400, fontSize: 14 }}>
              <Link href={titleSortHref} style={{ color: blue, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Title
                <span aria-hidden style={{ display: 'inline-flex', flexDirection: 'column', fontSize: 8, lineHeight: '8px', color: '#a7aaad' }}>
                  <span style={{ color: sortBy === 'title' && sortOrder === 'asc' ? '#1d2327' : undefined }}>▲</span>
                  <span style={{ color: sortBy === 'title' && sortOrder === 'desc' ? '#1d2327' : undefined }}>▼</span>
                </span>
              </Link>
            </th>
            <th scope="col" style={{ width: '16%', textAlign: 'left', padding: '12px 10px', fontWeight: 400, fontSize: 14 }}>Author</th>
            <th scope="col" style={{ width: '16%', textAlign: 'left', padding: '12px 10px', fontWeight: 400, fontSize: 14 }}>Categories</th>
            <th scope="col" style={{ width: '26%', textAlign: 'left', padding: '12px 10px', fontWeight: 400, fontSize: 14, color: blue }}>SEO Details</th>
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: 12 }}>No posts found.</td></tr>
          ) : posts.map((post: any, i: number) => {
            const viewHref = post.legacy_path || `/blog/${post.slug}/`;
            const suffix = post.status === 'published' ? '' : post.status === 'pending_review' ? ' — Pending' : post.status === 'draft' ? ' — Draft' : post.status === 'scheduled' ? ' — Scheduled' : post.status === 'trashed' ? '' : ` — ${post.status}`;
            return (
              <tr key={post.id} style={{ background: i % 2 === 0 ? '#f6f7f7' : '#fff', verticalAlign: 'top' }}>
                <th scope="row" style={{ padding: '12px 0 12px 12px', fontWeight: 400 }}><input type="checkbox" name="sel" value={post.id} aria-label={`Select ${post.title}`} /></th>
                <td style={{ padding: '10px' }}>
                  <Link href={`/seo-admin/blog/${post.id}`} style={{ fontWeight: 600, fontSize: 14, color: blue, textDecoration: 'none' }}>{post.title}</Link>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#50575e' }}>{suffix}</span>
                  <PostRowActions id={post.id} title={post.title} status={post.status} viewHref={viewHref} />
                </td>
                <td style={{ padding: '10px', wordBreak: 'break-all', color: blue }}>{post.author_name || '—'}</td>
                <td style={{ padding: '10px', color: blue }}>{post.category_names || '—'}</td>
                <td style={{ padding: '10px' }}>
                  {badge(post.seo_score)}
                  <div style={{ marginTop: 14 }}><strong>Keyword:</strong> {post.focus_keyword || <span style={{ color: '#787c82' }}>Not set</span>}</div>
                  <div style={{ marginTop: 10 }}><strong>Schema:</strong> Article ({post.schema_type || 'BlogPosting'})</div>
                  <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <strong>Links:</strong>
                    <span title="Internal links">🔗 {post.links_internal || 0}</span>|
                    <span title="External links">↗ {post.links_external || 0}</span>|
                    <span title="Incoming internal links" style={{ color: '#787c82' }}>↩ {post.links_incoming || 0}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid #c3c4c7' }}>
            <td style={{ padding: '12px 0 12px 12px' }}><input type="checkbox" data-select-all aria-label="Select All" /></td>
            <td style={{ padding: '12px 10px', fontSize: 14, color: blue }}>Title</td>
            <td style={{ padding: '12px 10px', fontSize: 14 }}>Author</td>
            <td style={{ padding: '12px 10px', fontSize: 14 }}>Categories</td>
            <td style={{ padding: '12px 10px', fontSize: 14, color: blue }}>SEO Details</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '8px 0 24px' }}>
        <BulkToolbar position="bottom" />
        {pager}
      </div>
      <div style={{ textAlign: 'left', margin: '0 0 24px' }}>
        <a href={`/api/v1/posts/export?${new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== 'page') as [string, string][]).toString()}`} style={{ fontSize: 13, color: blue }}>Export CSV</a>
      </div>
    </div>
  );
}
