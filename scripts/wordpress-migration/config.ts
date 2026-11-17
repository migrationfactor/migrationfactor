import { loadEnvConfig } from '@next/env';
import path from 'node:path';

loadEnvConfig(process.cwd());

/** WordPress is only ever read. Credentials (optional) are never printed or written to exports. */
export const config = {
  wpBaseUrl: (process.env.WP_BASE_URL || 'https://migrationfactor.com.au').replace(/\/+$/, ''),
  wpUsername: process.env.WP_USERNAME || '',
  wpAppPassword: process.env.WP_APP_PASSWORD || '',
  perPage: 100,
  maxRetries: 5,
  baseDelayMs: 500,
  batchSize: Number(process.env.WP_IMPORT_BATCH_SIZE || 10),
  /** Posts at WordPress sit at the site root: /{slug}/ */
  dataDir: path.resolve(process.cwd(), 'data/wordpress-migration'),
  exportFile: 'export.json',
  checkpointFile: 'checkpoint.json',
  reportBase: 'migration-report',
  /** Host serving the Next.js app for verification (staging or localhost). */
  nextBaseUrl: (process.env.MIGRATION_NEXT_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
};

export const hasWpAuth = () => Boolean(config.wpUsername && config.wpAppPassword);

export function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.split('=').slice(1).join('=') : 'true';
}
