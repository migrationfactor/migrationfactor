# Migration Factor — AI Handoff

Updated: 13 October 2026. Documentation only; no new implementation requested during this handoff.

## Project and stack
- Australian migration consultancy website: business services, visa guides, assessment, enquiries, consultation frontend and migration tools.
- **Actual root:** `C:\Users\bilal\OneDrive\Desktop\magrationfactormain`. Earlier chat/environment paths ending in `magrationfactor` or `migrationfactormain` may be stale.
- One root Next.js **16.4 App Router** app, React **19.3**, TypeScript, plain CSS, local Manrope fonts, Node >=20.9. Vercel configuration is at root. Do not recreate `nextjs-app/`.
- Supabase packages are installed, but the proposed database/admin system is not implemented. Never copy environment secrets into documentation.

## Completed
- Consolidated legacy/static and nested Next.js builds into one component-based root app.
- Approved teal UI, animations, logo-only rounded header, hover dropdowns/contact drawer, service listing and detail layouts restored. Tools/assessment dropdown styling improved.
- Editable business copy separated into `src/content/`; service and subclass designs use shared renderers.
- Imported **12 unique Word articles** from `content-input/`: 804; 143/173/864/884; 858; 309/100; 820/801; 300; 189; 190; 491; 870; 500; 600. Four `(1)` files are duplicates; originals preserved.
- Subclass renderer follows the supplied `pv-*` design: compact headings, image/text introduction, cards, vertical steps, open FAQs, tools and CTAs. Brand colours/font and visa-specific copy retained.
- Technical SEO: unique metadata/canonicals, social metadata, factual JSON-LD, sitemap/robots, security headers, responsive image/font improvements and bounded enquiry inputs.
- Eight tools implemented: PR points, visa quiz, general eligibility, 482 checker, business sponsor checker, sponsorship costs, applicant costs and occupation search. Logic/data separated from UI.
- Consultation frontend: free 30 minutes, Mon–Fri 09:00–21:00 **Asia/Karachi**, phone/video, validation and editable review. It deliberately does not reserve appointments or send confirmations.

## Latest user decision / pending work
- **Supplied `pv-*` CSS applies ONLY to subclass pages. Main service pages must keep their existing service design.** Add matching supplied content there only when required; do not apply the subclass design to every service.
- All 12 subclass guides are imported separately. Eight main services now have their own supplied Word content in `src/content/service-pages/`: Student, Partner, Parent, Business, Skilled, Employer Sponsored, Citizenship and Humanitarian/Protection. Visitor and Appeals/Reviews retain existing summaries pending their own documents. The subclass-derived `service-pages/overviews.ts` was removed; do not restore it.
- Content work centres on `src/content/services.ts`, `src/content/service-pages/index.ts` and `src/content/visa-subclasses/`; rendering is in `ServicePage.tsx` and `VisaArticlePage.tsx`.
- **Verified routing changes** are present: `src/lib/visa-path.ts`, `src/app/services/[slug]/[sub]/page.tsx`, existing service route, `next.config.ts`, sitemap and renderer links. They split e.g. `student-visa-500` into `/services/student/subclass-visa-500` and add permanent redirects from older paths. Use the helper rather than hardcoding old URLs.
- `/services/parent-visa` is now the main Parent Visa category. The unchanged 804 article was moved to `visa-subclasses/aged-parent-visa-804.ts` and is served at `/services/aged-parent/subclass-visa-804`. All 12 subclass URLs are distinct from the 10 main services; use `visaPath()` for links. Do not restore the old main/subclass collision.

## Next steps
1. Read `AGENTS.md`, inspect `git status`/diffs, and review installed Next.js docs before changing framework code. Preserve all uncommitted work.
2. Verify the new nested routes, old-URL redirects, canonical/JSON-LD paths, related links, sitemap and unknown-route 404s. Update older QA expectations where necessary.
3. Inventory `content-input/`; compare against the imported catalogue. Map any genuinely missing content to its matching page, keeping separate service/subclass templates and all source text.
4. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; smoke-test relevant pages at desktop/mobile widths and check console/hydration/overflow.
5. Report changes to the user. The user explicitly requested pushing completed changes on 13 October 2026. Future pushes still require authorization.

## Important limitations
- Latest main-content verification (14 October): TypeScript/lint, 41 tests, build (56 entries), 32 desktop/tablet/mobile browser cases, 1,015 supplied text entries and 19 internal link destinations passed. All 43 public sitemap pages returned 200 with unique full bodies/titles and present canonicals. See the latest entry in `IMPLEMENTATION.md`; older snapshots below are historical.
- Last verified subclass-design snapshot: typecheck/lint, **27 tests**, build **48 entries**, 36 browser cases (12 pages × 1440/390/320px), 30 internal links. Latest pre-push verification also passed lint, 27 tests, production build (48 entries), route/redirect checks above and 12 production browser cases for service/subclass pages at 1440/390/320px without overflow or page errors.
- Home mobile lab LCP remained ~4.1–4.5s; the 2.5s target is not met. Do not claim field Core Web Vitals success.
- Enquiries use local NDJSON plus optional HTTPS webhook. Vercel filesystem is not durable; rate limiting is process-local. Real production delivery/storage requires configuration/work.
- Booking backend/email/availability are intentionally deferred. Do not show fake saved bookings or available slots.
- Immigration rules/fees are dated snapshots, not live official data. Tools withhold fee/salary results after 30 June 2027. Supplied articles have not all received comprehensive legal review.
- Canonicals use `https://migrationfactor.com`; the last domain check found a separate Hostinger site. Deployment/domain connection remains unverified.
- `plan.md` is a future admin/leads/booking/blog/invoice/signature proposal, not completed work or automatic authorization.
- Preserve approved UI, existing content/images/motion, teal `#0b666a`/`#07484b`, cyan `#35b5ac`, dark teal `#042628`. Keep expert-members excluded; invent no testimonials, fees or qualifications.

## File map
- `content-input/` — supplied Word documents; `src/content/README.md` — editing guide.
- `src/content/services.ts`, `service-pages/`, `visa-subclasses/` — catalogue and long article copy.
- `src/components/pages/ServicePage.tsx`, `VisaArticlePage.tsx` — separate shared page designs.
- `src/app/services/`, `src/lib/visa-path.ts` — service/subclass routing and URL mapping.
- `src/components/layout/`, `sections/`, `shared/`, `ui/` — existing reusable site UI.
- `src/styles/visa-subclasses.css` — supplied subclass-only design; other `src/styles/` files preserve the site theme.
- `src/components/tools/`, `src/features/immigration-tools/` — tool UI, calculations and official data.
- `src/components/booking/`, `src/features/consultation-booking/model.ts` — consultation frontend/validation.
- `src/app/api/enquiries/`, `src/lib/enquiries-service.ts`, `enquiry-validation.ts` — enquiry API/storage/validation.
- `src/lib/seo.ts`, `src/app/sitemap.ts`, `robots.ts`, `layout.tsx` — SEO.
- `public/` — images/brand/fonts; `tests/`, `scripts/` — verification.
- `AGENTS.md`, `README.md`, `IMPLEMENTATION.md` — rules, setup and detailed historical evidence. `docs/` contains local QA artifacts and is Git-ignored.
- `package.json`, `next.config.ts`, `vercel.json`, `.env.example` — commands/deployment/configuration. Keep `.env*` secrets private.
