-- WordPress -> Next.js blog migration support. Additive and idempotent: no drops, no data changes.
-- Imported posts live in the existing seo_* tables; this adds only the external-ID links, the
-- untouched WordPress source/Rank Math snapshot, and a migration log.

alter table public.seo_posts add column if not exists wp_id bigint;
alter table public.seo_posts add column if not exists legacy_path varchar(1024);
create unique index if not exists idx_seo_posts_wp_id on public.seo_posts (wp_id) where wp_id is not null;
create unique index if not exists idx_seo_posts_legacy_path on public.seo_posts (legacy_path) where legacy_path is not null;

alter table public.seo_categories add column if not exists wp_id bigint;
alter table public.seo_tags add column if not exists wp_id bigint;
alter table public.seo_authors add column if not exists wp_id bigint;
alter table public.seo_media add column if not exists wp_id bigint;
create unique index if not exists idx_seo_categories_wp_id on public.seo_categories (wp_id) where wp_id is not null;
create unique index if not exists idx_seo_tags_wp_id on public.seo_tags (wp_id) where wp_id is not null;
create unique index if not exists idx_seo_authors_wp_id on public.seo_authors (wp_id) where wp_id is not null;
create unique index if not exists idx_seo_media_wp_id on public.seo_media (wp_id) where wp_id is not null;

-- Verbatim WordPress record + Rank Math head output, kept independent of the editable post fields.
create table if not exists public.seo_wp_post_source (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  wp_id bigint not null unique,
  wp_link text not null,
  wp_path varchar(1024) not null,
  wp_guid text,
  wp_status varchar(30),
  wp_date_gmt timestamptz,
  wp_modified_gmt timestamptz,
  wp_author_id bigint,
  title_rendered text,
  content_raw text,
  content_rendered text not null,
  excerpt_rendered text,
  categories jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  featured_media jsonb,
  rankmath jsonb not null default '{}'::jsonb,   -- title, description, canonical, robots, og{}, twitter{}, jsonld[], focus_keyword
  content_sha256 char(64) not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.seo_wp_migration_log (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  wp_id bigint,
  level varchar(10) not null default 'info',
  action varchar(30) not null,
  message text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_wp_migration_log_run on public.seo_wp_migration_log (run_id, id);

alter table public.seo_wp_post_source enable row level security;
alter table public.seo_wp_migration_log enable row level security;
