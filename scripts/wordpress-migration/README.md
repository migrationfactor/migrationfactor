# WordPress → Next.js blog migration

Source: `https://migrationfactor.com.au` (WordPress + Rank Math). Target: the existing `seo_*` tables in Supabase, managed by `/seo-admin`.
WordPress is only ever **read**. Exports and reports are written to `data/wordpress-migration/` (git-ignored).

## Commands

| Command | What it does |
| --- | --- |
| `npm run migrate:wp:inspect` | Read-only summary of what WordPress exposes (posts, taxonomies, media, Rank Math coverage). |
| `npm run migrate:wp:export` | Writes the JSON backup `export.json` (previous export is kept as `export-<ts>.bak.json`). |
| `npm run migrate:wp:media` | Downloads every referenced image (content, srcset sizes, featured, OG/Twitter/JSON-LD, author avatar) byte-for-byte into `public/media/blog/` and writes `media-manifest.json`. Run after `export`, before `import`. |
| `npm run migrate:wp:dry-run` | Transforms the export and compares with the DB. **No writes.** Report: `dry-run-report.csv/json`. |
| `npm run migrate:wp:import` | Idempotent upsert by `wp_id`, one transaction per post, batches, checkpoint + log. Flags: `--resume`, `--force`. |
| `npm run migrate:wp:verify` | Compares every WordPress page with the live Next.js page. Set `MIGRATION_NEXT_BASE_URL` (default `http://localhost:3000`). Writes `migration-report.csv/json` and `migration-report-failed.csv`. Exit code 1 on any mismatch. |

Optional env (never committed, never logged): `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` (application password → `context=edit`, raw block content + exact Rank Math focus keyword), `WP_IMPORT_BATCH_SIZE`.

## Audit findings

- **Record count is 8, not 120.** `GET /wp-json/wp/v2/posts` reports `X-WP-Total: 8`, `X-WP-TotalPages: 1`. The export script fails if fetched ≠ reported.
- **Permalinks** are root-level with a trailing slash: `/{slug}/` (no `/blog/` prefix). The existing Next.js blog served `/blog/{slug}`.
- **Rank Math fields are not exposed over REST** (`meta` only contains `footnotes`; `/rankmath/v1/getHead` does not exist). Title, description, canonical, robots, Open Graph, Twitter and JSON-LD are captured from the HTML `<head>` WordPress serves. The **focus keyword** is not in the head; it is derived from the first entry of the Rank Math `BlogPosting.keywords` JSON-LD field (flagged as a warning on each post). For the exact stored value add `rankmath-rest.php` (read-only `register_post_meta`) and set `WP_USERNAME` / `WP_APP_PASSWORD`, then `export` + `import --force`.
- Existing stack reused: `seo_posts`, `seo_post_seo`, `seo_post_social`, `seo_post_schema`, `seo_categories`, `seo_tags`, `seo_authors`, `seo_media`, `seo_post_*` link tables, sitemap routes, `proxy.ts`. DB access reuses the existing server-only `pg` pool (`DIRECT_URL`/`DATABASE_URL`, privileged), not a browser key.

## Database mapping (additive migration `20261118000000_wordpress_migration.sql`)

| WordPress | Supabase |
| --- | --- |
| post `id` | `seo_posts.wp_id` (unique) |
| permalink path | `seo_posts.legacy_path` (unique) + `seo_wp_post_source.wp_path` |
| `title.rendered` (entities decoded) | `seo_posts.title` |
| `slug` | `seo_posts.slug` |
| `content.rendered` (unmodified) | `seo_posts.body_html`; body_json = one `raw_html` block; raw block markup in `seo_wp_post_source.content_raw` |
| excerpt | `seo_posts.excerpt` (≤320; full text in source table) |
| `date_gmt` / `modified_gmt` | `published_at` / `modified_at` |
| featured media | `seo_media` (`wp_id`, `storage_path` = self-hosted `/media/blog/...`, alt, caption, dimensions) |
| categories / tags / author | `seo_categories` / `seo_tags` / `seo_authors` matched by `wp_id` then slug; existing rows are never overwritten |
| Rank Math title / description / canonical / robots / keywords | `seo_post_seo` |
| OG / Twitter | `seo_post_social` (`use_seo_values=false`) |
| JSON-LD (verbatim), full head snapshot | `seo_wp_post_source.rankmath`; `seo_post_schema.disable_auto=true` so no second graph is generated |
| run log | `seo_wp_migration_log`, plus `import-<runId>.log.ndjson` |

## Zero WordPress dependency (production host: `https://migrationfactor.com`)

Only two mechanical edits are applied to post HTML, metadata and JSON-LD (`rewrite-urls.ts`): WordPress upload/avatar URLs → `/media/blog/...` (root-relative in HTML, absolute in metadata), and `migrationfactor.com.au` → `https://migrationfactor.com` (override with `MIGRATION_TARGET_ORIGIN`). Text, headings, alt attributes and link paths are untouched. `/wp-content/uploads/*` redirects (permanent) to `/media/blog/*`, and two service links used by the posts redirect to their new guide pages. `verify` fails on any remaining `wp-content`, `wp-json` or old-host URL and on any non-self-hosted image.

## Next.js behaviour

- `/{slug}/` is served by `src/proxy.ts` (rewrite to the existing blog post route); `/{slug}` → 301 `/{slug}/`; `/blog/{slug}` → 301 `/{slug}/`.
- `skipTrailingSlashRedirect: true` is required for trailing-slash URLs; the proxy restores the old "strip trailing slash" 308 for every other path.
- `htmlLimitedBots: /.*/` forces metadata into `<head>` of the first HTML response for every user agent (otherwise Googlebot can receive it streamed into `<body>`).
- Migrated posts render their stored Rank Math metadata (`generateMetadata`) and JSON-LD verbatim; the layout's site-wide Organization/WebSite JSON-LD is suppressed on these URLs (`SiteJsonLdGate`) to avoid duplicates.
- Blog listings, categories, tags, author pages, RSS and the post sitemap link to / list the original permalinks.

## Known differences and risks (reported, not hidden)

1. **H1**: WordPress's only `<h1>` is the theme banner "Latest News"; the post title is a lower heading. Next.js uses the post title as the single `<h1>`. The `h1` check passes when the post title matches; the literal WP H1 is listed in the `wp_literal_h1` column.
2. **Editing in `/seo-admin`** re-runs the HTML sanitizer on save (the post body is a single `raw_html` block), which can strip markup. Changing a migrated post's slug in the admin will not move its `legacy_path`.
3. Two Rank Math keywords are the literal text `migrationfactor.com.au` (posts 6908, 6871); they are keyword text, not URLs, and were left as written.
4. WordPress has a `/blog/` page (HTTP 200) that Next.js's blog index will replace; WordPress pages other than posts (and tag/category/author archives, feeds, `wp-content` media) were out of scope and are not migrated. Images are self-hosted in `public/media/blog` (commit them with the code), so WordPress can be switched off.
5. Focus keywords are derived (see audit); `--force` import is needed to re-apply SEO-only changes because unchanged content/modified-date skips a post.

## Cutover checklist (requires explicit approval for each step; none has been done)

- [ ] Staging deploy of this branch; `MIGRATION_NEXT_BASE_URL=<staging> npm run migrate:wp:verify` → `accepted: true`.
- [ ] Commit `public/media/blog/` with the code. Configure the old host (`migrationfactor.com.au`) to 301 every path to the same path on `migrationfactor.com` before WordPress is removed.
- [ ] Apply migration `20261118000000_wordpress_migration.sql` to production DB (already applied to the DB this project points at) and run `export` → `dry-run` → `import`.
- [ ] Re-run `export`/`import --force` right before cutover to catch edits made in WordPress meanwhile.
- [ ] Decide what happens to every other WordPress URL (pages, `/blog/`, categories, tags, feeds, sitemaps): redirect map or keep.
- [ ] Submit `sitemap_index.xml` to Search Console; keep WordPress live until verified.
- [ ] **Approval needed**: production deployment → DNS change → disabling the WordPress frontend → removing hosting → deleting WordPress content/media.
- [ ] Post-cutover: re-run verify against production, monitor Search Console coverage, 404s and indexing for 4–6 weeks.
