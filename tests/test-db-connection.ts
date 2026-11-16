import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { query } from '../src/lib/seo-system/db';

async function main() {
  const roles = await query('SELECT id, name FROM public.seo_roles ORDER BY id');
  console.log('Roles from DB:', roles);
  const settings = await query('SELECT key FROM public.seo_settings ORDER BY key');
  console.log('Settings keys from DB:', settings);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
