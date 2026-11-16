-- -----------------------------------------------------------------------------
-- SEO, GEO & AEO Blog Management System
-- Schema Migration (Baseline Specification 1.0)
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Roles and Permissions (RBAC Foundation - Section 18)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_roles (
  id varchar(40) primary key,
  name varchar(80) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_permissions (
  id varchar(60) primary key,
  category varchar(40) not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_role_permissions (
  role_id varchar(40) not null references public.seo_roles(id) on delete cascade,
  permission_id varchar(60) not null references public.seo_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.seo_users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  name varchar(120) not null,
  password_hash varchar(255) not null,
  status varchar(30) not null default 'active',
  mfa_enabled boolean not null default false,
  mfa_secret_enc text,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_user_roles (
  user_id uuid not null references public.seo_users(id) on delete cascade,
  role_id varchar(40) not null references public.seo_roles(id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists public.seo_sessions (
  id varchar(128) primary key,
  user_id uuid not null references public.seo_users(id) on delete cascade,
  csrf_token varchar(128) not null,
  ip_hash varchar(64),
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_sessions_user on public.seo_sessions(user_id);
create index if not exists idx_seo_sessions_expires on public.seo_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- 2. Media Library and Responsive Variants (FR-MED-001 to 005)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_media (
  id uuid primary key default gen_random_uuid(),
  filename varchar(255) not null,
  storage_path varchar(500) not null,
  mime_type varchar(100) not null,
  width integer not null,
  height integer not null,
  size_bytes bigint not null,
  checksum_sha256 char(64),
  title varchar(120),
  alt varchar(150) not null default '',
  caption varchar(300),
  description text,
  credit varchar(150),
  license varchar(100),
  focus_x smallint not null default 50,
  focus_y smallint not null default 50,
  is_decorative_default boolean not null default false,
  iptc jsonb,
  uploaded_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_media_filename on public.seo_media(filename);
create index if not exists idx_seo_media_created on public.seo_media(created_at desc);

create table if not exists public.seo_media_variants (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.seo_media(id) on delete cascade,
  purpose varchar(30) not null,
  format varchar(10) not null,
  width integer not null,
  height integer not null,
  size_bytes bigint not null,
  storage_path varchar(500) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_media_variants_media on public.seo_media_variants(media_id);

create table if not exists public.seo_media_usage (
  media_id uuid not null references public.seo_media(id) on delete restrict,
  entity_type varchar(50) not null,
  entity_id uuid not null,
  field varchar(100) not null,
  created_at timestamptz not null default now(),
  primary key (media_id, entity_type, entity_id, field)
);

create index if not exists idx_seo_media_usage_entity on public.seo_media_usage(entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 3. Taxonomies and Authors (FR-TAX-001 to 003)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.seo_categories(id) on delete set null,
  name varchar(100) not null,
  slug varchar(100) not null unique,
  description text,
  seo_title varchar(200),
  meta_description varchar(400),
  robots_index boolean not null default true,
  canonical_url varchar(2048),
  og_image_media_id uuid references public.seo_media(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_tags (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  slug varchar(100) not null unique,
  description text,
  seo_title varchar(200),
  meta_description varchar(400),
  robots_index boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.seo_users(id) on delete set null,
  display_name varchar(100) not null,
  slug varchar(100) not null unique,
  job_title varchar(120),
  bio_short varchar(600),
  bio_long text,
  photo_media_id uuid references public.seo_media(id) on delete set null,
  credentials jsonb not null default '[]'::jsonb,
  same_as jsonb not null default '[]'::jsonb,
  expertise jsonb not null default '[]'::jsonb,
  is_reviewer boolean not null default false,
  x_handle varchar(50),
  email varchar(254),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 4. Core Posts and Child Extension Tables (FR-BLG-001, Section 14)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_posts (
  id uuid primary key default gen_random_uuid(),
  status varchar(30) not null default 'draft' check (status in ('draft', 'pending_review', 'scheduled', 'published', 'unpublished', 'trashed')),
  prior_status varchar(30),
  title varchar(200) not null,
  slug varchar(200) not null,
  body_json jsonb not null default '{"blocks":[]}'::jsonb,
  body_html text not null default '',
  excerpt varchar(320),
  featured_media_id uuid references public.seo_media(id) on delete set null,
  featured_alt_override varchar(150),
  featured_caption_override varchar(300),
  primary_category_id uuid references public.seo_categories(id) on delete set null,
  published_at timestamptz,
  modified_at timestamptz,
  scheduled_at timestamptz,
  unpublish_behavior varchar(20) default '404',
  trashed_at timestamptz,
  trashed_by uuid references public.seo_users(id) on delete set null,
  version integer not null default 1,
  word_count integer not null default 0,
  reading_time_min integer not null default 1,
  template varchar(30) not null default 'standard',
  show_updated_date boolean not null default true,
  password_hash varchar(255),
  language varchar(10),
  translation_group_id uuid,
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_seo_posts_slug on public.seo_posts(slug) where (status <> 'trashed');
create index if not exists idx_seo_posts_status_published on public.seo_posts(status, published_at desc);
create index if not exists idx_seo_posts_status_modified on public.seo_posts(status, modified_at desc);

create table if not exists public.seo_post_seo (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  focus_keyword varchar(80),
  additional_keywords jsonb not null default '[]'::jsonb,
  seo_title_raw varchar(200),
  seo_title_effective varchar(255) not null default '',
  seo_title_hash char(64),
  meta_description_raw varchar(400),
  meta_description_effective varchar(400),
  meta_description_hash char(64),
  canonical_url varchar(2048),
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  robots_advanced jsonb not null default '{"nosnippet":false,"max_snippet":-1,"max_image_preview":"large","max_video_preview":-1,"noimageindex":false,"notranslate":false,"unavailable_after":null,"indexifembedded":false,"noarchive":false}'::jsonb,
  breadcrumb_title varchar(70),
  custom_h1 varchar(200),
  sitemap_include boolean not null default true,
  is_cornerstone boolean not null default false
);

create index if not exists idx_seo_post_seo_focus on public.seo_post_seo(focus_keyword);
create index if not exists idx_seo_post_seo_title_hash on public.seo_post_seo(seo_title_hash);
create index if not exists idx_seo_post_seo_desc_hash on public.seo_post_seo(meta_description_hash);

create table if not exists public.seo_post_social (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  use_seo_values boolean not null default true,
  og_title varchar(200),
  og_description varchar(400),
  og_image_media_id uuid references public.seo_media(id) on delete set null,
  twitter_card varchar(30) not null default 'summary_large_image',
  twitter_title varchar(200),
  twitter_description varchar(200),
  twitter_image_media_id uuid references public.seo_media(id) on delete set null
);

create table if not exists public.seo_post_schema (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  article_type varchar(30) not null default 'BlogPosting',
  headline_override varchar(110),
  description_override varchar(400),
  faq_enabled boolean not null default false,
  howto_enabled boolean not null default false,
  custom_jsonld jsonb,
  custom_mode varchar(20) not null default 'add',
  disable_auto boolean not null default false,
  validation_status varchar(20) not null default 'valid',
  validation_report jsonb not null default '{"errors":[],"warnings":[]}'::jsonb,
  validated_at timestamptz
);

create table if not exists public.seo_post_geo_aeo (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  primary_question varchar(150),
  related_questions jsonb not null default '[]'::jsonb,
  answer_summary text,
  intent varchar(30) not null default 'informational',
  primary_entity jsonb,
  secondary_entities jsonb not null default '[]'::jsonb,
  original_insight boolean not null default false,
  insight_note text,
  review_interval_months smallint not null default 12,
  reviewed_at timestamptz,
  reviewed_by uuid references public.seo_authors(id) on delete set null
);

create table if not exists public.seo_post_authors (
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  author_id uuid not null references public.seo_authors(id) on delete cascade,
  position smallint not null default 1,
  role varchar(20) not null default 'author',
  primary key (post_id, author_id, role)
);

create table if not exists public.seo_post_categories (
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  category_id uuid not null references public.seo_categories(id) on delete cascade,
  primary key (post_id, category_id)
);

create table if not exists public.seo_post_tags (
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  tag_id uuid not null references public.seo_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.seo_post_references (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  position smallint not null default 1,
  title varchar(255) not null,
  url varchar(2048) not null,
  publisher varchar(120),
  published_date varchar(50),
  accessed_date date,
  note text,
  last_status smallint,
  last_checked_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 5. Revisions, Autosaves and Edit Locks (FR-BLG-002, 011)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_post_revisions (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  revision_no integer not null,
  action varchar(30) not null,
  snapshot jsonb not null,
  scores jsonb,
  source varchar(30) not null default 'user',
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (post_id, revision_no)
);

create index if not exists idx_seo_post_revisions_lookup on public.seo_post_revisions(post_id, revision_no desc);

create table if not exists public.seo_post_autosaves (
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  user_id uuid not null references public.seo_users(id) on delete cascade,
  snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.seo_edit_locks (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  user_id uuid not null references public.seo_users(id) on delete cascade,
  acquired_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 6. Scoring, Analysis and Scoring Configuration (Section 7, FR-SCR-001)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_scoring_config (
  version integer primary key,
  config jsonb not null,
  active boolean not null default false,
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_analysis (
  post_id uuid primary key references public.seo_posts(id) on delete cascade,
  revision_id bigint,
  config_version integer not null default 1,
  overall smallint,
  basic smallint,
  additional smallint,
  readability smallint,
  technical smallint,
  geo smallint,
  aeo smallint,
  checks jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now()
);

create index if not exists idx_seo_analysis_overall on public.seo_analysis(overall);
create index if not exists idx_seo_analysis_geo on public.seo_analysis(geo);
create index if not exists idx_seo_analysis_aeo on public.seo_analysis(aeo);

-- -----------------------------------------------------------------------------
-- 7. Links Graph and Redirects (FR-LNK-001 to 005, FR-TEC-009, 010)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_links (
  id bigint generated always as identity primary key,
  source_post_id uuid not null references public.seo_posts(id) on delete cascade,
  target_url varchar(2048) not null,
  target_url_normalized varchar(2048) not null,
  target_post_id uuid references public.seo_posts(id) on delete set null,
  is_internal boolean not null default true,
  anchor_text varchar(255) not null default '',
  rel varchar(50),
  position varchar(30) not null default 'body',
  last_status smallint,
  redirect_target varchar(2048),
  last_checked_at timestamptz
);

create index if not exists idx_seo_links_source on public.seo_links(source_post_id);
create index if not exists idx_seo_links_target_post on public.seo_links(target_post_id);
create index if not exists idx_seo_links_target_norm on public.seo_links(target_url_normalized);

create table if not exists public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path varchar(1024) not null,
  match_type varchar(20) not null default 'exact' check (match_type in ('exact', 'regex')),
  priority integer not null default 10,
  target_url varchar(2048) not null,
  target_post_id uuid references public.seo_posts(id) on delete set null,
  http_code smallint not null default 301 check (http_code in (301, 302, 307, 308, 410, 451)),
  active boolean not null default true,
  auto_created boolean not null default false,
  hits bigint not null default 0,
  last_hit_at timestamptz,
  notes text,
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_redirects_lookup on public.seo_redirects(source_path) where (active = true);

create table if not exists public.seo_url_tombstones (
  path varchar(1024) primary key,
  former_post_id uuid,
  http_code smallint not null default 410,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_not_found_daily (
  path varchar(1024) not null,
  day date not null,
  hits bigint not null default 1,
  referrers jsonb not null default '[]'::jsonb,
  ua_classes jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'new' check (status in ('new', 'ignored', 'redirected')),
  primary key (path, day)
);

create index if not exists idx_seo_not_found_day on public.seo_not_found_daily(day desc);

-- -----------------------------------------------------------------------------
-- 8. Technical SEO, Sitemaps and Robots (FR-TEC-001, 004)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_sitemap_files (
  name varchar(100) primary key,
  type varchar(30) not null,
  part integer not null default 1,
  url_count integer not null default 0,
  generated_at timestamptz not null default now(),
  checksum varchar(64),
  storage_path varchar(500) not null,
  lastmod timestamptz not null default now()
);

create table if not exists public.seo_robots_txt_versions (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default false,
  note varchar(255)
);

-- -----------------------------------------------------------------------------
-- 9. Indexing Integrations (Section 12, FR-IDX-001 to 008)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_indexing_submissions (
  id bigint generated always as identity primary key,
  post_id uuid references public.seo_posts(id) on delete cascade,
  url varchar(2048) not null,
  channel varchar(30) not null check (channel in ('gsc_sitemap', 'gsc_manual', 'indexing_api', 'indexnow', 'bing')),
  action varchar(30) not null check (action in ('submit', 'update', 'delete', 'inspect')),
  triggered_by varchar(30) not null check (triggered_by in ('user', 'event', 'retry')),
  user_id uuid references public.seo_users(id) on delete set null,
  requested_at timestamptz not null default now(),
  response_code smallint,
  response_excerpt text,
  status varchar(20) not null default 'queued' check (status in ('queued', 'submitted', 'accepted', 'failed')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_seo_indexing_sub_post on public.seo_indexing_submissions(post_id, requested_at desc);
create index if not exists idx_seo_indexing_sub_retry on public.seo_indexing_submissions(status, next_retry_at);

create table if not exists public.seo_index_inspections (
  id bigint generated always as identity primary key,
  post_id uuid references public.seo_posts(id) on delete cascade,
  url varchar(2048) not null,
  inspected_at timestamptz not null default now(),
  verdict varchar(50),
  coverage_state varchar(100),
  indexing_state varchar(100),
  robots_txt_state varchar(100),
  page_fetch_state varchar(100),
  last_crawl_time timestamptz,
  google_canonical varchar(2048),
  user_canonical varchar(2048),
  rich_results jsonb not null default '[]'::jsonb,
  inspection_link varchar(2048),
  raw jsonb
);

create index if not exists idx_seo_inspections_post on public.seo_index_inspections(post_id, inspected_at desc);

create table if not exists public.seo_search_performance_daily (
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  date date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(5,4) not null default 0,
  position numeric(5,2) not null default 0,
  primary key (post_id, date)
);

create table if not exists public.seo_search_queries_28d (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.seo_posts(id) on delete cascade,
  query varchar(255) not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  position numeric(5,2) not null default 0,
  refreshed_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 10. Settings, Credentials and Audit Logging (Section 14.5, Section 18)
-- -----------------------------------------------------------------------------

create table if not exists public.seo_settings (
  key varchar(80) primary key,
  value jsonb not null,
  updated_by uuid references public.seo_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.seo_settings_history (
  id bigint generated always as identity primary key,
  key varchar(80) not null,
  value jsonb not null,
  changed_by uuid references public.seo_users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.seo_integration_credentials (
  id varchar(60) primary key,
  provider varchar(40) not null,
  encrypted_payload text not null,
  scopes text,
  status varchar(30) not null default 'configured',
  created_by uuid references public.seo_users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  last_used_at timestamptz
);

create table if not exists public.seo_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.seo_users(id) on delete set null,
  actor_role varchar(40),
  action varchar(80) not null,
  entity_type varchar(50) not null,
  entity_id varchar(120),
  before jsonb,
  after jsonb,
  ip_hash varchar(64),
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_audit_entity on public.seo_audit_logs(entity_type, entity_id);
create index if not exists idx_seo_audit_created on public.seo_audit_logs(created_at desc);

create table if not exists public.seo_scheduled_jobs (
  id bigint generated always as identity primary key,
  event_type varchar(60) not null,
  aggregate_id uuid,
  payload jsonb not null,
  status varchar(20) not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_jobs_status_avail on public.seo_scheduled_jobs(status, available_at);

-- -----------------------------------------------------------------------------
-- 11. Initial Seeds: Roles, Permissions, Default Settings, Scoring Config V1
-- -----------------------------------------------------------------------------

insert into public.seo_roles (id, name, description) values
  ('super_admin', 'Super Admin', 'Full control over all content, technical settings, credentials and user permissions'),
  ('admin', 'Admin', 'Can manage all posts, users, media, schema, and redirects'),
  ('seo_manager', 'SEO Manager', 'Dedicated SEO specialist: full SEO/GEO/AEO access, redirects, robots.txt, schema, and dashboard'),
  ('editor', 'Editor', 'Can create, edit, and publish any blog post and media'),
  ('author', 'Author', 'Can create and edit own draft blog posts and submit for review')
on conflict (id) do nothing;

insert into public.seo_permissions (id, category, description) values
  ('post.create', 'posts', 'Create new blog posts'),
  ('post.edit', 'posts', 'Edit own draft and pending posts'),
  ('post.edit_any', 'posts', 'Edit any blog post'),
  ('post.publish', 'posts', 'Publish, schedule, update, or unpublish posts'),
  ('post.delete', 'posts', 'Move posts to trash and restore'),
  ('post.delete_permanent', 'posts', 'Permanently delete posts and record tombstone'),
  ('seo.edit', 'seo', 'Edit title, description, focus keywords'),
  ('seo.edit_advanced', 'seo', 'Change robots meta and custom canonical URLs'),
  ('seo.reports', 'seo', 'View SEO dashboard and analytical reports'),
  ('robots.edit', 'technical', 'Modify robots.txt configuration'),
  ('redirects.edit', 'technical', 'Create and modify 301/302/410 redirects'),
  ('sitemaps.manage', 'technical', 'Regenerate XML sitemaps'),
  ('indexing.submit', 'indexing', 'Request indexing and retry failed submissions'),
  ('gsc.connect', 'integrations', 'Connect and manage Google Search Console OAuth'),
  ('schema.edit', 'schema', 'Change article schema options'),
  ('schema.edit_custom', 'schema', 'Edit custom JSON-LD and templates'),
  ('taxonomy.manage', 'taxonomies', 'Create and manage categories and tags'),
  ('authors.manage', 'authors', 'Create and manage author profiles'),
  ('media.upload', 'media', 'Upload new media items'),
  ('media.edit', 'media', 'Edit media alt, title, and metadata'),
  ('media.delete', 'media', 'Delete media items (subject to usage check)'),
  ('settings.seo_global', 'settings', 'Modify global SEO and organization settings'),
  ('settings.permalinks', 'settings', 'Modify permalink structure pattern'),
  ('users.manage', 'users', 'Create and manage users and roles'),
  ('audit.read', 'audit', 'View audit logs')
on conflict (id) do nothing;

-- Super Admin: all permissions
insert into public.seo_role_permissions (role_id, permission_id)
select 'super_admin', id from public.seo_permissions
on conflict do nothing;

-- Admin: all except credentials connect and permalink structure
insert into public.seo_role_permissions (role_id, permission_id)
select 'admin', id from public.seo_permissions
where id not in ('gsc.connect', 'settings.permalinks')
on conflict do nothing;

-- SEO Manager: dedicated SEO permissions
insert into public.seo_role_permissions (role_id, permission_id)
values
  ('seo_manager', 'post.create'),
  ('seo_manager', 'post.edit_any'),
  ('seo_manager', 'post.publish'),
  ('seo_manager', 'seo.edit'),
  ('seo_manager', 'seo.edit_advanced'),
  ('seo_manager', 'seo.reports'),
  ('seo_manager', 'robots.edit'),
  ('seo_manager', 'redirects.edit'),
  ('seo_manager', 'sitemaps.manage'),
  ('seo_manager', 'indexing.submit'),
  ('seo_manager', 'schema.edit'),
  ('seo_manager', 'schema.edit_custom'),
  ('seo_manager', 'taxonomy.manage'),
  ('seo_manager', 'authors.manage'),
  ('seo_manager', 'media.upload'),
  ('seo_manager', 'media.edit'),
  ('seo_manager', 'settings.seo_global'),
  ('seo_manager', 'audit.read')
on conflict do nothing;

-- Editor
insert into public.seo_role_permissions (role_id, permission_id)
values
  ('editor', 'post.create'),
  ('editor', 'post.edit_any'),
  ('editor', 'post.publish'),
  ('editor', 'post.delete'),
  ('editor', 'seo.edit'),
  ('editor', 'seo.reports'),
  ('editor', 'schema.edit'),
  ('editor', 'taxonomy.manage'),
  ('editor', 'media.upload'),
  ('editor', 'media.edit'),
  ('editor', 'media.delete')
on conflict do nothing;

-- Author
insert into public.seo_role_permissions (role_id, permission_id)
values
  ('author', 'post.create'),
  ('author', 'post.edit'),
  ('author', 'seo.edit'),
  ('author', 'media.upload')
on conflict do nothing;

-- Default Scoring Config V1 (Section 7, 8, 9)
insert into public.seo_scoring_config (version, config, active)
values (1, '{
  "weights": {
    "basic": 40,
    "additional": 25,
    "readability": 20,
    "technical": 15
  },
  "basic_checks": {
    "B1": 12, "B2": 6, "B3": 10, "B4": 8, "B5": 10,
    "B6": 10, "B7": 8, "B8": 6, "B9": 10, "B10": 10,
    "B11": 5, "B12": 5
  },
  "additional_checks": {
    "A1": 12, "A2": 8, "A3": 10, "A4": 8, "A5": 4, "A6": 8,
    "A7": 12, "A8": 10, "A9": 10, "A10": 8, "A11": 5, "A12": 5
  },
  "readability_checks": {
    "R1": 20, "R2": 15, "R3": 10, "R4": 15, "R5": 10,
    "R6": 10, "R7": 10, "R8": 5, "R9": 5
  },
  "technical_checks": {
    "T1": 15, "T2": 10, "T3": 10, "T4": 8, "T5": 4, "T6": 12,
    "T7": 6, "T8": 8, "T9": 8, "T10": 7, "T11": 4, "T12": 4, "T13": 4
  },
  "geo_checks": {
    "G1": 14, "G2": 10, "G3": 10, "G4": 6, "G5": 8, "G6": 8,
    "G7": 10, "G8": 6, "G9": 8, "G10": 6, "G11": 5, "G12": 5, "G13": 4
  },
  "aeo_checks": {
    "Q1": 15, "Q2": 15, "Q3": 12, "Q4": 12, "Q5": 8,
    "Q6": 8, "Q7": 10, "Q8": 10, "Q9": 10
  },
  "thresholds": {
    "word_count_good": 800,
    "word_count_min": 300,
    "keyword_density_min": 0.5,
    "keyword_density_max": 2.5,
    "keyword_density_stuffing": 3.0,
    "flesch_reading_ease_good": 60,
    "flesch_reading_ease_ok": 40,
    "avg_sentence_len_good": 20,
    "avg_sentence_len_ok": 25,
    "long_sentence_percent_max": 25,
    "paragraph_len_max": 150,
    "passive_voice_percent_max": 10
  }
}'::jsonb, true)
on conflict (version) do nothing;

-- Default Global SEO Settings (FR-SEO-000)
insert into public.seo_settings (key, value) values
  ('general', '{
    "site_name": "Migration Factor",
    "alternate_site_name": "Migration Factor Australia",
    "canonical_base_url": "https://migrationfactor.com",
    "title_separator": "|",
    "default_post_title_template": "%title% %sep% %sitename%",
    "default_category_title_template": "%category% Archive %sep% %sitename%",
    "default_tag_title_template": "%tag% Articles %sep% %sitename%",
    "default_meta_description_template": "",
    "permalink_pattern": "/blog/{slug}/"
  }'::jsonb),
  ('organization', '{
    "name": "Migration Factor",
    "legal_name": "Migration Factor Pty Ltd",
    "url": "https://migrationfactor.com/",
    "logo_url": "https://migrationfactor.com/brand/mark.webp",
    "description": "Registered Australian migration and educational consulting services.",
    "telephone": "+92 300 1234567",
    "email": "info@migrationfactor.com",
    "same_as": [
      "https://www.linkedin.com/company/migration-factor",
      "https://x.com/migrationfactor"
    ]
  }'::jsonb),
  ('content_defaults', '{
    "require_featured_image": true,
    "min_word_count": 300,
    "readability_language": "en",
    "auto_toc_threshold": 4,
    "trusted_domains": ["gov.au", "homeaffairs.gov.au", "immi.homeaffairs.gov.au", "education.gov.au", "legislation.gov.au"]
  }'::jsonb),
  ('social_defaults', '{
    "default_og_image": "https://migrationfactor.com/media/hero.webp",
    "x_site_handle": "@migrationfactor"
  }'::jsonb),
  ('robots_defaults', '{
    "posts": {"index": true, "follow": true, "max_snippet": -1, "max_image_preview": "large", "max_video_preview": -1},
    "categories": {"index": true, "follow": true},
    "tags": {"index": false, "follow": true},
    "authors": {"index": true, "follow": true},
    "search": {"index": false, "follow": false}
  }'::jsonb),
  ('indexing', '{
    "indexnow_enabled": false,
    "indexnow_key": "4f9d2b8c1a7e6f3d9c8b7a6f5e4d3c2b",
    "indexnow_endpoint": "https://api.indexnow.org/indexnow",
    "google_indexing_api_enabled": false
  }'::jsonb)
on conflict (key) do nothing;

-- Default Robots.txt version (FR-TEC-004)
insert into public.seo_robots_txt_versions (content, active, note)
values (
'User-agent: *
Disallow: /admin/
Disallow: /seo-admin/
Disallow: /api/
Disallow: /preview/
Disallow: /search
Allow: /

Sitemap: https://migrationfactor.com/sitemap_index.xml',
true,
'Default system robots.txt'
)
on conflict do nothing;
