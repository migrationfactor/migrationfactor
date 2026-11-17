-- Aligns the migration history with the schema the SEO system code actually uses.
-- These statements were previously applied by hand (scripts/add-db-aliases.ts) and are
-- idempotent, so they are safe on databases that already have them.

alter table public.seo_media add column if not exists url varchar(500) generated always as (storage_path) stored;
alter table public.seo_media add column if not exists alt_text varchar(150) generated always as (alt) stored;
alter table public.seo_media add column if not exists storage_key varchar(500) generated always as (storage_path) stored;
alter table public.seo_media add column if not exists file_size bigint generated always as (size_bytes) stored;

alter table public.seo_users add column if not exists display_name varchar(100) generated always as (name) stored;
alter table public.seo_authors add column if not exists avatar_url varchar(500);

alter table public.seo_redirects add column if not exists note text;
-- ON CONFLICT (source_path) upserts in the application require a real unique index.
create unique index if not exists idx_seo_redirects_source_path_unique on public.seo_redirects (source_path);

alter table public.seo_url_tombstones add column if not exists url_path varchar(1024) generated always as (path) stored;
alter table public.seo_url_tombstones add column if not exists post_id uuid;
alter table public.seo_url_tombstones add column if not exists original_title varchar(200);
alter table public.seo_url_tombstones add column if not exists deleted_by uuid;
