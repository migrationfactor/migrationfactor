/**
 * The only place the SEO admin reads the site's address and name from the environment.
 * Set NEXT_PUBLIC_SITE_URL (for example https://example.com) and, optionally, NEXT_PUBLIC_SITE_NAME.
 * The visible site name used in titles and schema comes from Settings (stored in the database).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');

/** Host without protocol and without a leading "www.". */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');

/** Fallback display name until a name is saved in Settings. */
export const SITE_NAME = (process.env.NEXT_PUBLIC_SITE_NAME || '').trim() || SITE_HOST;

/** Two-letter badge text derived from a name (admin bar and login). */
export const initials = (name: string) => (name.match(/[A-Za-z0-9]+/g) || []).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '·';
