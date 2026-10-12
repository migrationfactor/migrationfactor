Ready for review
Select text to add comments on the plan
MigrationFactor: Website to System (Admin, Leads, Booking, Blog, Invoices, Signatures, Meta)
Context
The site today is a polished marketing site (Next.js 16.4, React 19, plain CSS, UI locked by AGENTS.md). The business side is not real yet. The audit found:

Enquiries are appended to a local NDJSON file (src/lib/enquiries-service.ts). That file does not persist on Vercel. No email is ever sent.
Rate limiting is an in-memory Map (api/enquiries/route.ts). It resets per serverless instance, so it is not real protection.
/consultation is frontend-only and never submits. It hardcodes Asia/Karachi and a static "Free".
Supabase packages are installed and env names exist, but no source code uses Supabase. Resend is not installed.
There is no blog. There are 2 static guide pages and no /guides index. The sitemap has no lastModified.
SITE_URL is hardcoded in lib/constants.ts. Security headers are duplicated in vercel.json and next.config.ts.
Goal: turn this into a small system on free tiers, with Vercel hosting, Supabase as DB/auth/storage/backend, and Resend for email. The system covers:

Admin panel
Unified leads (website + Meta)
Booking
SEO blog
Invoices
Signature tool
Stripe later (on hold)
Business rule: Pakistan gets free booking; international users never see "Free".

Advice: how separate should frontend and backend be?
You asked for advice, so here is my recommendation. You decide at the end.

Recommended: a "modular monolith". One repo, one Next.js app, one Vercel project, with hard folder and import boundaries.

Frontend folders never import backend folders. The backend is server-only, and an ESLint rule enforces the boundary.
Why this fits you:
Free tier means one deploy, one cache, and no CORS.
Admin login cookies work without extra setup.
It avoids over-engineering.
Because the backend is already isolated, you can extract /admin into its own app later in about a day. Do that only if the admin gets heavy or you want admin.migrationfactor.com.
Not recommended now:

Option	Why not now
Monorepo with 3 apps (web, admin, packages)	Extra tooling, duplicated config, 2 projects to deploy and debug. Useful only when there is a team.
2 separate repos	Types and validation get duplicated. Slowest to work with.
Two things to confirm before relying on the free tiers (limits as I know them, so verify current numbers):

Vercel Hobby is for non-commercial use. A business site officially needs Pro, and the paid-booking phase makes this clearer. Plan for Pro before real launch.
Supabase free pauses after about 7 days of inactivity and has no automated backups. The mitigations are below.
Target folder structure (additive; the current UI folders do not move)
src/
├─ app/                         # ROUTING ONLY. Thin files that call modules.
│  ├─ (site)/                   # public website: the current pages move here, UI unchanged
│  │   ├─ blog/                 #   index, [slug], category/[slug], tag/[slug]
│  │   └─ guides/               #   becomes DB-driven; the 2 existing guides migrate to posts
│  ├─ (admin)/admin/            # login, dashboard, leads, bookings, blog, clients,
│  │                            #   invoices, signatures, settings   (noindex, no-store)
│  ├─ sign/[token]/             # public signer page for the signature tool
│  ├─ api/
│  │   ├─ public/               # enquiries, bookings, availability, region (rate-limited)
│  │   ├─ webhooks/             # meta, resend, (stripe later)
│  │   └─ cron/                 # keep-alive, reminders, backup trigger
│  ├─ sitemap.ts  robots.ts  rss.xml/route.ts
│  └─ ...
├─ proxy.ts                     # Next 16 replaces middleware with proxy. Admin redirect + geo header only.
│
├─ components/                  # FRONTEND (public). Existing layout/sections/shared/ui/booking/tools stay as-is.
├─ admin-ui/                    # FRONTEND (admin). Tables, filters, markdown editor, invoice builder,
│                               #   signature pad. Kept apart so the public bundle never includes it.
│
├─ backend/                     # SERVER ONLY (`import 'server-only'`)
│  ├─ modules/                  # one folder per business area, same internal shape
│  │   ├─ leads/                #   service.ts (rules) · repository.ts (DB) · schema.ts (zod) · policy.ts
│  │   ├─ bookings/             #   availability, pricing tier (PK vs intl), ICS, reminders
│  │   ├─ blog/                 #   posts, categories, tags, revalidation, SEO fields
│  │   ├─ clients/
│  │   ├─ invoices/             #   numbering, totals, PDF, send
│  │   ├─ signatures/           #   documents, signers, audit trail
│  │   └─ settings/
│  ├─ integrations/
│  │   ├─ resend/               #   client, templates, outbox sender
│  │   ├─ meta/                 #   webhook verify, Graph API lead fetch, mapper
│  │   └─ stripe/               #   (empty placeholder; implemented later)
│  └─ platform/                 # supabase clients (anon / user / service), auth guard, rate-limit,
│                               #   cache tags, env validation, logger, audit log
│
├─ shared/                      # PURE, importable by both sides: zod schemas, enums, types,
│                               #   constants (lead source, status, currency, country rules)
├─ lib/  features/  styles/     # existing; gradually reduced as logic moves into shared/backend
supabase/
├─ migrations/                  # SQL, versioned and reviewed
├─ seed.sql
└─ config.toml
tests/                          # existing Node test runner; add one folder per module
docs/architecture/              # ADRs, data model, runbooks (docs/ stays gitignored, so use a tracked folder)
Boundary rules (enforced by ESLint no-restricted-imports):

components/** and admin-ui/** may import only shared/** and call the API or server actions.
backend/** is server-only.
app/api/** and server actions do four things only: validate with zod, call the auth guard, call a module service, and return the result.
Only repository.ts files talk to Supabase.
Data model (Supabase Postgres, RLS on every table)
Access control

admin_users (user_id, role: owner | staff)
audit_log (actor, action, entity, entity_id, diff, ip, at)
Leads

leads: id, source, name, email, phone_e164, country, service, message, status, assigned_to, dedupe_key, meta_ref, utm, consent, created_at.
Source values: website_form | visa_assessment | booking | meta_facebook | meta_instagram | whatsapp | manual.
lead_events: timeline of status changes, notes, and emails sent.
visa_assessments: a structured profile instead of today's flattened message text.
Bookings

availability_rules (weekday, start, end, slot_minutes, timezone)
availability_overrides (date off or extra)
bookings: lead_id, starts_at (timestamptz), format, pricing_tier: pk_free | international, status, payment_status, pricing_flags (e.g. geo mismatch), notes.
Blog and SEO

posts: slug, title, body_md, excerpt, cover path, status, published_at, updated_at, author_id, category_id.
SEO fields: seo_title, seo_description, canonical, og_image, schema_type, faq jsonb, reading_time.
categories, tags, post_tags, authors.
redirects (from, to, code): created automatically when a slug changes.
Money and signing

clients
invoices (number, client, currency PKR/AUD/USD, status, issue and due dates, totals, pdf_path)
invoice_items
invoice_sequences: a DB function issues gapless numbers.
payments: provider-agnostic, so Stripe plugs in later.
documents, document_signers (token_hash, expiry), signatures (image path, signed_at, ip, ua, doc_hash), signature_audit
Infrastructure

email_outbox: queue with status, attempts, and idempotency key
rate_limits: key, window, count
app_settings
Security model

The browser never writes leads or bookings directly.
Public forms hit /api/public/*, which does the following in order: rate-limit, honeypot and Turnstile check, zod validation, service module, and a write with the service role key.
Anon RLS allows read of published posts only. Everything else is admin-only through admin_users.
The service role key exists only under backend/platform and only as an env var.
Admin login uses Supabase Auth (email + password, with TOTP MFA recommended for the owner). The @supabase/ssr package is already installed.
proxy.ts only does optimistic redirects. The real auth check runs in every admin data call and route handler, as the Next docs recommend.
Key flows
Pakistan vs international (booking)

The server decides the tier, never the client.
pk_free if the phone is +92 AND (Vercel x-vercel-ip-country = PK OR declared residence = Pakistan).
Anything else is international. A mismatch (+92 phone but a non-PK IP, or the reverse) is flagged pricing_flags for admin review.
UI: the public pages stay statically cached, so a geo-based "Free" label must not be baked in.
Show neutral wording by default.
A tiny client island calls /api/public/region (no-store) and reveals "Free consultation" for PK only.
International users never see "Free".
International bookings are created as pending_payment / "request". There is no payment yet. Stripe slots in later through payments and a webhook.
Replace the hardcoded Asia/Karachi slots with availability_rules. Confirm one thing: the business is in Perth/Melbourne but the current form uses Karachi time. Which timezone should admin availability use? Show slots in the visitor's timezone.
Emails (Resend): booking confirmation to the client with an ICS file, alert to admin, reminder by daily cron.
Leads in one dashboard

Every entry point (contact form, home enquiry, visa assessment, booking) goes into the leads table through one leads.service.create().
Dedupe by normalized email or E.164 phone, so repeat contacts become lead_events instead of duplicate rows.
Meta Lead Ads: POST /api/webhooks/meta.
Verify X-Hub-Signature-256.
Fetch the lead with the Graph API using leadgen_id.
Map it to a lead with source meta_facebook or meta_instagram, deduped.
Meta needs a Facebook App, a Page token, and possibly app review and business verification. Start the review early; it takes time.
WhatsApp and Instagram DMs come later through the same source column.
Blog and SEO backend

Admin writes markdown with a simple editor and preview, not a heavy WYSIWYG. Images go to Supabase Storage (public bucket, webp, size-limited).
The public blog is statically generated. Publish, edit and unpublish call revalidateTag('posts') plus a path revalidate, so the DB is almost never hit by visitors.
SEO output:
Per-post metadata through the existing pageMetadata() in lib/seo.ts
pageSchema() extended with Article dates and image
FAQPage and BreadcrumbList JSON-LD
A dynamic sitemap with real lastModified
RSS
Canonical and OG per post
Redirects table checked in proxy.ts
Internal-link suggestions in the editor
Category and tag pages
Migrate the two existing guides to posts rows, keeping their URLs. Add a /guides index.
Invoices and signatures

Invoice PDF with @react-pdf/renderer (works on serverless; avoid headless Chrome). Store it in a private bucket, serve it through signed URLs, and send it via the Resend outbox.
Signature tool:
Admin uploads a PDF or picks a template and adds signers.
The signer opens /sign/[token]. The token is random, stored as a hash, and expires.
The signer draws or types a signature.
The server stamps it onto the PDF with pdf-lib, stores a SHA-256 hash, and records IP, UA and time in signature_audit.
A signed copy is emailed to everyone.
Free-tier strategy (cache, rate limit, low resources)
Concern	Approach
Public page load	Stay on the current caching model (no cacheComponents for now). Pages are static or ISR with tag-based on-demand revalidation. Visitors do not touch the DB.
Admin	Fully dynamic, no-store, noindex. Small pages, server-side pagination (25 rows), indexed columns, select only needed fields.
Rate limiting	Replace the in-memory Map with a Postgres atomic counter (rate_limits plus one RPC). Add the honeypot and Cloudflare Turnstile (free). No new vendor. Use Upstash Redis only if the DB counter becomes a bottleneck.
Resend free (about 100/day, 3000/month, one domain)	Outbox queue with retry and idempotency. Send only essential transactional mail. A daily-count guard warns the admin at about 80%. SPF/DKIM/DMARC on the domain.
Supabase pause	A Vercel Cron daily ping touches the DB. This is also required as the real-traffic fallback.
Supabase backups	A scheduled GitHub Action runs pg_dump weekly to a private location. Storage assets are exported by script.
Vercel functions	Keep handlers short. Do PDF and email work after the response (after()). Use one cron per day (Hobby cron is limited).
Storage	Webp only, compress on upload, size caps per bucket.
Pagination for webhooks	Meta and Resend webhooks return 200 fast and process idempotently.
Phased roadmap
Housekeeping.
Decide the structure with you.
Update AGENTS.md ("single root app" is replaced by "modular monolith with boundaries").
Commit the pending changes.
Create the Supabase project (region closest to users), verify the Resend domain, and make SITE_URL env-driven.
Read node_modules/next/dist/docs (route handlers, proxy.md, authentication.md, caching) before writing code.
Foundation. Folder skeleton and lint boundaries, env validation, Supabase clients, migrations plus RLS, admin auth, proxy.ts, rate limiter, audit log, and the email outbox.
Leads. Replace the NDJSON service with leads. Add Resend notifications. Add an admin leads list with status, notes and assignment. Make visa assessment structured.
Booking. Availability, tier logic, region island, emails and ICS, and the admin calendar. Update scripts/verify-site.mjs, which currently asserts that consultation never POSTs.
Blog and SEO. Tables, editor, public pages, sitemap, JSON-LD, redirects, and migration of the 2 guides.
Clients, invoices and PDF.
Signature tool.
Meta lead integration.
Stripe (on hold, by your decision). Payment links or Checkout for international bookings and invoices, plus webhook into payments.
Fixes to fold in
Remove the NDJSON store and the in-memory limiter.
Make SITE_URL env-driven.
Remove the duplicated headers between vercel.json and next.config.ts.
Remove /api/config, which only reports the webhook.
Add lastModified to the sitemap.
Add a /guides index.
Remove the hardcoded "Free" and Karachi timezone from the consultation form.
Verification (per phase)
Always run npm run typecheck, npm run lint, npm run build, and npm test.
Leads:
Submit a form and see the DB row, the Resend email and the admin entry.
Duplicates are merged.
The rate limiter blocks after the limit.
The honeypot rejects.
Booking:
A PK phone plus PK geo shows "Free" and tier pk_free.
Simulated non-PK shows no "Free" and tier international.
A mismatch is flagged.
A double-booked slot is rejected by a DB constraint.
Blog:
Publish and see the page appear without a rebuild.
The sitemap contains the post, the JSON-LD validates, and a slug change 301s.
RLS:
An anon client cannot read leads, bookings or invoices.
A non-admin user is blocked.
Meta: a test lead from Meta's Lead Ads testing tool arrives as a leads row.
Run the extended scripts/verify-site.mjs: every sitemap URL is 200, unique titles, no hydration errors, and the UI is visually unchanged (locked by AGENTS.md).
Open items for you to decide at the end
Final structure: modular monolith (recommended) vs 3-app monorepo vs 2 repos.
Which timezone the booking availability uses (Pakistan or Perth/Melbourne).
Vercel Pro before launch (Hobby is non-commercial).
Whether to start the Meta app review now, since it can take days or weeks.