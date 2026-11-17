import { config, hasWpAuth } from './config';

export interface WpResponse<T> { data: T; headers: Headers; status: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function authHeader(): Record<string, string> {
  if (!hasWpAuth()) return {};
  const token = Buffer.from(`${config.wpUsername}:${config.wpAppPassword}`).toString('base64');
  return { Authorization: `Basic ${token}` };
}

/** GET with retry + exponential backoff (with jitter). Retries network errors, 429 and 5xx. */
export async function wpGet<T = unknown>(url: string, opts: { auth?: boolean; text?: boolean } = {}): Promise<WpResponse<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: opts.text ? 'text/html' : 'application/json', 'User-Agent': 'MigrationFactor-WP-Migration/1.0', ...(opts.auth ? authHeader() : {}) },
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status} for ${url}`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`) as Error & { fatal: boolean };
        err.fatal = true; // 4xx other than 429 will not succeed on retry
        throw err;
      }
      const data = (opts.text ? await res.text() : await res.json()) as T;
      return { data, headers: res.headers, status: res.status };
    } catch (e) {
      lastError = e;
      if ((e as { fatal?: boolean }).fatal || attempt === config.maxRetries) break;
      const delay = config.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(`  retry ${attempt + 1}/${config.maxRetries} in ${delay}ms: ${(e as Error).message}`);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const wpUrl = (route: string, params: Record<string, string | number> = {}) => {
  const u = new URL(`${config.wpBaseUrl}/wp-json/wp/v2/${route}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
};

/** Fetch every page of a collection; returns items plus the server-reported totals for validation. */
export async function wpGetAll<T>(route: string, params: Record<string, string | number> = {}, auth = false) {
  const items: T[] = [];
  let page = 1;
  let total = 0;
  let totalPages = 1;
  do {
    const res = await wpGet<T[]>(wpUrl(route, { per_page: config.perPage, page, ...params }), { auth });
    items.push(...res.data);
    total = Number(res.headers.get('x-wp-total') ?? items.length);
    totalPages = Number(res.headers.get('x-wp-totalpages') ?? 1);
    page++;
  } while (page <= totalPages);
  return { items, total, totalPages };
}
