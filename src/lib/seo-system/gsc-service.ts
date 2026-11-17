import 'server-only';
import crypto from 'node:crypto';
import { query, queryOne } from './db';
import { logAudit } from './audit';
import { SITE_URL } from './technical-seo';
import { encryptSecret, decryptSecret } from './secret-box';

/**
 * Google Search Console integration (FR-IDX-001/002/003/008).
 * OAuth 2.0 authorization-code flow with PKCE; the refresh token is stored AES-256-GCM encrypted.
 * Honest status: nothing here ever marks a URL "indexed" except a URL Inspection verdict of PASS.
 */

const CRED_ID = 'gsc_oauth';
export const GSC_SCOPE_WRITE = 'https://www.googleapis.com/auth/webmasters';
export const GSC_SCOPE_READ = 'https://www.googleapis.com/auth/webmasters.readonly';
const SITES_API = 'https://www.googleapis.com/webmasters/v3/sites';
const INSPECT_API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/v1/integrations/gsc/oauth/callback`;
}

/* ----------------------------- OAuth (PKCE) ----------------------------- */

export function createAuthRequest(origin: string, write: boolean) {
  const state = crypto.randomBytes(24).toString('hex');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(origin),
    response_type: 'code',
    scope: `openid email ${write ? GSC_SCOPE_WRITE : GSC_SCOPE_READ}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state, verifier };
}

export async function completeAuth(code: string, verifier: string, origin: string, userId: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  const tok: any = await res.json().catch(() => ({}));
  if (!res.ok || !tok.refresh_token) {
    throw new Error(tok.error_description || 'Google did not return a refresh token. Remove the app from your Google account permissions and connect again.');
  }
  let email = '';
  try {
    email = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString()).email || '';
  } catch {
    /* email is informational only */
  }
  const payload = encryptSecret(JSON.stringify({ refreshToken: tok.refresh_token, email }));
  await query(
    `INSERT INTO public.seo_integration_credentials (id, provider, encrypted_payload, scopes, status, created_by)
     VALUES ($1, 'gsc_oauth', $2, $3, 'connected', $4)
     ON CONFLICT (id) DO UPDATE SET encrypted_payload = EXCLUDED.encrypted_payload, scopes = EXCLUDED.scopes,
       status = 'connected', rotated_at = now()`,
    [CRED_ID, payload, String(tok.scope || ''), userId]
  );
  cached = null;
  await logAudit({ actorId: userId, action: 'integration.gsc_connect', entityType: 'integration', afterState: { email, scopes: tok.scope } });
  return { email };
}

/* ----------------------------- tokens ----------------------------- */

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const row = await queryOne<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.seo_integration_credentials WHERE id = $1`, [CRED_ID]);
  if (!row) throw Object.assign(new Error('Search Console is not connected.'), { status: 409 });
  const { refreshToken } = JSON.parse(decryptSecret(row.encrypted_payload));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tok: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    await query(`UPDATE public.seo_integration_credentials SET status = 'expired' WHERE id = $1`, [CRED_ID]);
    throw Object.assign(new Error('Google access was revoked or expired. Reconnect Search Console.'), { status: 409 });
  }
  cached = { token: tok.access_token, exp: Date.now() + (tok.expires_in || 3600) * 1000 };
  await query(`UPDATE public.seo_integration_credentials SET last_used_at = now(), status = 'connected' WHERE id = $1`, [CRED_ID]);
  return cached.token;
}

async function google(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

function plainError(status: number, body: any): string {
  const msg = body?.error?.message || body?.error_description || '';
  if (status === 403) return `403 - Your Google account no longer has permission for this property. Reconnect Search Console. ${msg}`.trim();
  if (status === 429) return `429 - Google quota reached. Try again later. ${msg}`.trim();
  return `${status} - ${msg || 'Google returned an error.'}`;
}

/* ----------------------------- status & property ----------------------------- */

export async function getConnection() {
  const cred = await queryOne<any>(`SELECT scopes, status, last_used_at, created_at FROM public.seo_integration_credentials WHERE id = $1`, [CRED_ID]);
  let email = '';
  if (cred) {
    try {
      const row = await queryOne<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.seo_integration_credentials WHERE id = $1`, [CRED_ID]);
      email = JSON.parse(decryptSecret(row!.encrypted_payload)).email || '';
    } catch {
      email = '';
    }
  }
  const setting = await queryOne<{ value: any }>(`SELECT value FROM public.seo_settings WHERE key = 'gsc'`);
  const scopes: string = cred?.scopes || '';
  return {
    configured: googleConfigured(),
    connected: Boolean(cred) && cred.status === 'connected',
    status: cred ? cred.status : 'disconnected',
    email,
    canSubmitSitemaps: scopes.includes(GSC_SCOPE_WRITE),
    property: setting?.value?.property || null,
    permissionLevel: setting?.value?.permissionLevel || null,
    sitemap: setting?.value?.sitemap || null,
    lastUsedAt: cred?.last_used_at || null,
  };
}

export async function listProperties() {
  const r = await google(SITES_API);
  if (!r.ok) throw new Error(plainError(r.status, r.body));
  const host = new URL(SITE_URL).host;
  return ((r.body?.siteEntry as any[]) || []).map((s) => ({
    siteUrl: s.siteUrl as string,
    permissionLevel: s.permissionLevel as string,
    matchesSite: s.siteUrl === `sc-domain:${host.replace(/^www\./, '')}` || String(s.siteUrl).startsWith(SITE_URL),
  }));
}

export async function selectProperty(siteUrl: string, userId: string) {
  const props = await listProperties();
  const chosen = props.find((p) => p.siteUrl === siteUrl);
  if (!chosen) throw Object.assign(new Error('That property is not available to the connected Google account.'), { status: 422 });
  if (!chosen.matchesSite) throw Object.assign(new Error(`The property must cover ${SITE_URL}.`), { status: 422 });
  await saveSetting('gsc', { property: chosen.siteUrl, permissionLevel: chosen.permissionLevel }, true, userId);
  await logAudit({ actorId: userId, action: 'integration.gsc_property', entityType: 'integration', afterState: chosen });
  return chosen;
}

async function saveSetting(key: string, value: Record<string, unknown>, merge: boolean, userId?: string) {
  await query(
    `INSERT INTO public.seo_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = ${merge ? 'public.seo_settings.value || EXCLUDED.value' : 'EXCLUDED.value'}, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), userId || null]
  );
}

async function requireProperty(): Promise<string> {
  const conn = await getConnection();
  if (!conn.connected) throw Object.assign(new Error('Search Console is not connected.'), { status: 409 });
  if (!conn.property) throw Object.assign(new Error('Choose a Search Console property first.'), { status: 409 });
  return conn.property;
}

export async function disconnect(userId: string) {
  const row = await queryOne<{ encrypted_payload: string }>(`SELECT encrypted_payload FROM public.seo_integration_credentials WHERE id = $1`, [CRED_ID]);
  if (row) {
    try {
      const { refreshToken } = JSON.parse(decryptSecret(row.encrypted_payload));
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken }),
      });
    } catch {
      /* revocation is best effort; the local copy is deleted regardless */
    }
  }
  await query(`DELETE FROM public.seo_integration_credentials WHERE id = $1`, [CRED_ID]);
  await query(`DELETE FROM public.seo_settings WHERE key = 'gsc'`);
  cached = null;
  await logAudit({ actorId: userId, action: 'integration.gsc_disconnect', entityType: 'integration' });
}

/* ----------------------------- sitemaps (FR-IDX-002) ----------------------------- */

async function record(postId: string | null, url: string, channel: string, action: string, userId: string | null, code: number | null, excerpt: string, status: string) {
  await query(
    `INSERT INTO public.seo_indexing_submissions (post_id, url, channel, action, triggered_by, user_id, response_code, response_excerpt, status, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
    [postId, url, channel, action, userId ? 'user' : 'event', userId, code, excerpt.slice(0, 500), status]
  );
}

/** Submits the sitemap index. Throttled to once per 15 minutes (events within the window are skipped). */
export async function submitSitemap(userId: string | null, force = false) {
  const conn = await getConnection();
  if (!conn.connected) throw Object.assign(new Error('Search Console is not connected.'), { status: 409 });
  if (!conn.canSubmitSitemaps) throw Object.assign(new Error('Connected in read-only mode. Reconnect with full access to submit sitemaps.'), { status: 409 });
  const property = await requireProperty();
  const feed = `${SITE_URL}/sitemap_index.xml`;

  if (!force) {
    const recent = await queryOne(
      `SELECT 1 FROM public.seo_indexing_submissions WHERE channel = 'gsc_sitemap' AND url = $1 AND status = 'accepted' AND requested_at > now() - interval '15 minutes'`,
      [feed]
    );
    if (recent) return { throttled: true, message: 'Sitemap was already submitted in the last 15 minutes.' };
  }

  const r = await google(`${SITES_API}/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(feed)}`, { method: 'PUT' });
  const ok = r.ok;
  await record(null, feed, 'gsc_sitemap', 'submit', userId, r.status, ok ? 'Sitemap submitted to Google Search Console' : plainError(r.status, r.body), ok ? 'accepted' : 'failed');
  if (!ok) throw Object.assign(new Error(plainError(r.status, r.body)), { status: 502 });
  return { throttled: false, message: 'Sitemap submitted. Google decides when to crawl it.' };
}

/** Reads Google's processing status for the sitemap (lastSubmitted, lastDownloaded, errors, warnings). */
export async function refreshSitemapStatus() {
  const property = await requireProperty();
  const feed = `${SITE_URL}/sitemap_index.xml`;
  const r = await google(`${SITES_API}/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(feed)}`);
  if (!r.ok) throw Object.assign(new Error(plainError(r.status, r.body)), { status: 502 });
  const b = r.body || {};
  const sitemap = {
    lastSubmitted: b.lastSubmitted || null,
    lastDownloaded: b.lastDownloaded || null,
    isPending: Boolean(b.isPending),
    errors: Number(b.errors || 0),
    warnings: Number(b.warnings || 0),
    checkedAt: new Date().toISOString(),
  };
  await saveSetting('gsc', { sitemap }, true);
  return sitemap;
}

/* ----------------------------- URL Inspection (FR-IDX-003) ----------------------------- */

export function postPublicUrl(slug: string) {
  return `${SITE_URL}/blog/${slug}`;
}

export async function inspectPost(postId: string, userId: string | null, force = false) {
  const post = await queryOne<{ slug: string; status: string }>(`SELECT slug, status FROM public.seo_posts WHERE id = $1`, [postId]);
  if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
  if (post.status !== 'published') throw Object.assign(new Error('Only published posts can be inspected.'), { status: 422 });
  const property = await requireProperty();
  const url = postPublicUrl(post.slug);

  if (!force) {
    const recent = await queryOne(`SELECT 1 FROM public.seo_index_inspections WHERE post_id = $1 AND inspected_at > now() - interval '10 minutes'`, [postId]);
    if (recent) throw Object.assign(new Error('This URL was inspected less than 10 minutes ago.'), { status: 429 });
  }

  const r = await google(INSPECT_API, {
    method: 'POST',
    body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'en-AU' }),
  });
  if (!r.ok) {
    await record(postId, url, 'gsc_manual', 'inspect', userId, r.status, plainError(r.status, r.body), 'failed');
    throw Object.assign(new Error(plainError(r.status, r.body)), { status: 502 });
  }
  const res = r.body?.inspectionResult || {};
  const idx = res.indexStatusResult || {};
  const inserted = await queryOne<any>(
    `INSERT INTO public.seo_index_inspections (post_id, url, verdict, coverage_state, indexing_state, robots_txt_state, page_fetch_state,
       last_crawl_time, google_canonical, user_canonical, rich_results, inspection_link, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      postId, url, idx.verdict || null, idx.coverageState || null, idx.indexingState || null, idx.robotsTxtState || null,
      idx.pageFetchState || null, idx.lastCrawlTime || null, idx.googleCanonical || null, idx.userCanonical || null,
      JSON.stringify(res.richResultsResult?.detectedItems || []), res.inspectionResultLink || null, JSON.stringify(res),
    ]
  );
  const alerts: string[] = [];
  if (idx.googleCanonical && idx.userCanonical && idx.googleCanonical !== idx.userCanonical) alerts.push('Google chose a different canonical URL than the one declared.');
  if (/noindex/i.test(String(idx.coverageState || '')) ) alerts.push('Google reports a noindex rule on this URL.');
  if (idx.robotsTxtState === 'DISALLOWED') alerts.push('robots.txt blocks Google from this URL.');
  return { inspection: inserted, alerts };
}

/* ----------------------------- search analytics (FR-IDX-008) ----------------------------- */

export async function syncSearchAnalytics() {
  const property = await requireProperty();
  const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // data is delayed 2-3 days
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const posts = await query<{ id: string; slug: string }>(`SELECT id, slug FROM public.seo_posts WHERE status = 'published'`);
  const bySlug = new Map(posts.map((p) => [postPublicUrl(p.slug), p.id]));
  if (bySlug.size === 0) return { pages: 0 };
  const endpoint = `${SITES_API}/${encodeURIComponent(property)}/searchAnalytics/query`;
  const filter = { dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/blog/' }] }] };

  const daily = await google(endpoint, { method: 'POST', body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['date', 'page'], rowLimit: 5000, ...filter }) });
  if (!daily.ok) throw Object.assign(new Error(plainError(daily.status, daily.body)), { status: 502 });
  let pages = 0;
  for (const row of (daily.body?.rows as any[]) || []) {
    const postId = bySlug.get(String(row.keys[1]).replace(/\/$/, ''));
    if (!postId) continue;
    pages++;
    await query(
      `INSERT INTO public.seo_search_performance_daily (post_id, date, clicks, impressions, ctr, position) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (post_id, date) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr, position = EXCLUDED.position`,
      [postId, row.keys[0], row.clicks, row.impressions, Math.min(row.ctr, 9.9999), Math.min(row.position, 999.99)]
    );
  }

  const queries = await google(endpoint, { method: 'POST', body: JSON.stringify({ startDate: start, endDate: end, dimensions: ['page', 'query'], rowLimit: 5000, ...filter }) });
  if (queries.ok) {
    await query(`DELETE FROM public.seo_search_queries_28d`);
    for (const row of (queries.body?.rows as any[]) || []) {
      const postId = bySlug.get(String(row.keys[0]).replace(/\/$/, ''));
      if (!postId) continue;
      await query(
        `INSERT INTO public.seo_search_queries_28d (post_id, query, clicks, impressions, position) VALUES ($1,$2,$3,$4,$5)`,
        [postId, String(row.keys[1]).slice(0, 255), row.clicks, row.impressions, Math.min(row.position, 999.99)]
      );
    }
  }
  await saveSetting('gsc', { analyticsSyncedAt: new Date().toISOString() }, true);
  return { pages };
}

/* ----------------------------- scheduled maintenance ----------------------------- */

/** Daily job: sitemap status, due inspections (within a daily budget) and analytics. Never throws. */
export async function runGscMaintenance(budget = 40) {
  const out: Record<string, unknown> = {};
  try {
    const conn = await getConnection();
    if (!conn.connected || !conn.property) return { skipped: 'not connected' };
    try { out.sitemap = await refreshSitemapStatus(); } catch (e: any) { out.sitemapError = e.message; }

    // +1d, +3d, +7d, +14d after the last change, then monthly; recently changed posts go first
    const due = await query<{ id: string }>(
      `SELECT p.id FROM public.seo_posts p
       LEFT JOIN LATERAL (SELECT max(inspected_at) AS last FROM public.seo_index_inspections i WHERE i.post_id = p.id) li ON true
       WHERE p.status = 'published'
         AND (li.last IS NULL
              OR (p.modified_at > now() - interval '14 days' AND li.last < now() - interval '20 hours')
              OR li.last < now() - interval '30 days')
       ORDER BY p.modified_at DESC LIMIT $1`,
      [budget]
    );
    let inspected = 0;
    for (const p of due) {
      try { await inspectPost(p.id, null, true); inspected++; } catch (e: any) { if (e.status === 409) break; }
    }
    out.inspected = inspected;
    try { out.analytics = await syncSearchAnalytics(); } catch (e: any) { out.analyticsError = e.message; }
  } catch (e: any) {
    out.error = e.message;
  }
  return out;
}

/** After publish/update/unpublish: resubmits the sitemap (throttled, never throws). */
export async function notifyAfterChange(): Promise<void> {
  try {
    const conn = await getConnection();
    if (conn.connected && conn.canSubmitSitemaps && conn.property) await submitSitemap(null);
  } catch {
    /* hints only: a failed notification must never fail a publish */
  }
}
