import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

/**
 * WordPress goes away completely, so the migrated pages must not reference it:
 *  - every WordPress upload / avatar URL becomes a self-hosted file under /media/blog (see localize-media.ts)
 *  - the old host (migrationfactor.com.au) becomes the production origin (migrationfactor.com)
 * These are the ONLY edits made to post HTML, metadata and JSON-LD. Text, headings, alt attributes and link paths are untouched.
 */
export const TARGET_ORIGIN = (process.env.MIGRATION_TARGET_ORIGIN || 'https://migrationfactor.com').replace(/\/+$/, '');
export const MEDIA_URL_PREFIX = '/media/blog';
export const MEDIA_DIR = path.resolve(process.cwd(), 'public/media/blog');
export const manifestPath = () => path.join(config.dataDir, 'media-manifest.json');

/** Original absolute URL (as it appears in the source) -> site-relative local path, e.g. /media/blog/2026/04/a.webp */
export type MediaManifest = Record<string, string>;

export function loadManifest(): MediaManifest {
  if (!fs.existsSync(manifestPath())) return {};
  const entries = JSON.parse(fs.readFileSync(manifestPath(), 'utf8')) as Array<{ url: string; localPath: string }>;
  const map: MediaManifest = {};
  for (const e of entries) map[e.url] = e.localPath;
  return map;
}

const OLD_HOST = /https?:\/\/(?:www\.)?migrationfactor\.com\.au/gi;

/** mode 'html' keeps media root-relative (works on any host); 'absolute' is for metadata and JSON-LD. */
export function rewriteString(input: string, manifest: MediaManifest, mode: 'html' | 'absolute'): string {
  let s = input;
  const keys = Object.keys(manifest).sort((a, b) => b.length - a.length);
  for (const url of keys) {
    const local = mode === 'html' ? manifest[url] : `${TARGET_ORIGIN}${manifest[url]}`;
    for (const variant of new Set([url, url.split('&').join('&amp;'), url.split('&amp;').join('&')])) s = s.split(variant).join(local);
  }
  return s.replace(OLD_HOST, TARGET_ORIGIN);
}

export function rewriteDeep<T>(value: T, manifest: MediaManifest): T {
  if (typeof value === 'string') return rewriteString(value, manifest, 'absolute') as T;
  if (Array.isArray(value)) return value.map((v) => rewriteDeep(v, manifest)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteDeep(v, manifest)])) as T;
  return value;
}

/** Any URL still pointing at WordPress after rewriting (reported, never ignored). Plain-text mentions such as a keyword are not URLs. */
export const leftoverWpRefs = (s: string) => s.match(/(?:wp-content|wp-includes|wp-json|\/\/(?:www\.)?migrationfactor\.com\.au)[^"'\s<>)]*/gi) ?? [];
