import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { query } from '../src/lib/seo-system/db';

async function run() {
  console.log('Adding database column aliases for seamless compatibility...');
  try {
    await query(`
      ALTER TABLE public.seo_media 
      ADD COLUMN IF NOT EXISTS url varchar(500) GENERATED ALWAYS AS (storage_path) STORED;
    `);
    console.log('Added url to seo_media');

    await query(`
      ALTER TABLE public.seo_media 
      ADD COLUMN IF NOT EXISTS alt_text varchar(150) GENERATED ALWAYS AS (alt) STORED;
    `);
    console.log('Added alt_text to seo_media');

    await query(`
      ALTER TABLE public.seo_media 
      ADD COLUMN IF NOT EXISTS storage_key varchar(500) GENERATED ALWAYS AS (storage_path) STORED;
    `);
    console.log('Added storage_key to seo_media');

    await query(`
      ALTER TABLE public.seo_media 
      ADD COLUMN IF NOT EXISTS file_size bigint GENERATED ALWAYS AS (size_bytes) STORED;
    `);
    console.log('Added file_size to seo_media');

    await query(`
      ALTER TABLE public.seo_users 
      ADD COLUMN IF NOT EXISTS display_name varchar(100) GENERATED ALWAYS AS (name) STORED;
    `);
    console.log('Added display_name to seo_users');

    await query(`
      ALTER TABLE public.seo_authors 
      ADD COLUMN IF NOT EXISTS avatar_url varchar(500);
    `);
    console.log('Added avatar_url to seo_authors');

    await query(`
      ALTER TABLE public.seo_redirects 
      ADD COLUMN IF NOT EXISTS note text;
    `);
    console.log('Added note to seo_redirects');

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_redirects_source_path_unique 
      ON public.seo_redirects (source_path);
    `);
    console.log('Added unique index on seo_redirects(source_path)');

    await query(`
      ALTER TABLE public.seo_url_tombstones 
      ADD COLUMN IF NOT EXISTS url_path varchar(1024) GENERATED ALWAYS AS (path) STORED;
    `);
    console.log('Added url_path to seo_url_tombstones');

    await query(`
      ALTER TABLE public.seo_url_tombstones 
      ADD COLUMN IF NOT EXISTS post_id uuid;
    `);
    await query(`
      ALTER TABLE public.seo_url_tombstones 
      ADD COLUMN IF NOT EXISTS original_title varchar(200);
    `);
    await query(`
      ALTER TABLE public.seo_url_tombstones 
      ADD COLUMN IF NOT EXISTS deleted_by uuid;
    `);
    console.log('Enriched seo_url_tombstones');

    console.log('DB aliases successfully established!');
    process.exit(0);
  } catch (err) {
    console.error('Error applying DB aliases:', err);
    process.exit(1);
  }
}

run();
