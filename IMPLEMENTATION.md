# Migration Factor implementation and verification

Source audit date: 10 October 2026. Final local verification: 12 October 2026. Application: the single Next.js app at the repository root.

## Scope and preserved UI

The approved homepage, content, photographs, typography, motion, section ordering, logo-only rounded header and contact drawer are preserved. New links live inside the existing Home/Guides dropdowns and mobile drawer. New pages use scoped styles and the existing brand variables. The only existing visible color adjustment is white footer-button text to correct measured contrast. No expert-members section, invented reviews, business qualifications or prices were added.

## SEO and technical work

- Page-specific canonical, Open Graph and Twitter metadata uses the confirmed `https://migrationfactor.com` domain. The home title also carries the business name.
- Public pages have WebPage/Service/Article and breadcrumb JSON-LD where relevant, plus factual Organization and WebSite nodes. JSON is escaped safely. No invented ratings, people or registration details are included. FAQ rich-result schema was not added to this commercial migration consultancy.
- The sitemap includes the new public tools and consultation page, consistently uses canonical paths, and no longer asserts a fabricated last-modified date. Robots allows public pages and excludes API crawling. API responses also carry noindex headers; missing pages return 404 with noindex.
- Hero responsive sizing/fetch priority, shared image sizing and early local-font preload address the measured loading bottleneck without removing visuals or animation. Phones up to 430px receive a lossless centre crop of the same airport photo through a responsive picture source. Its decoded pixels were checked against the original crop; the original wide asset stays intact. AVIF is negotiated with WebP fallback. The decorative footer airplane retains its original image bytes.
- Security headers apply in Next.js as well as Vercel. `X-Powered-By` is disabled. Unversioned static assets use a bounded cache lifetime instead of a year-long immutable declaration.
- Enquiry JSON reads are byte-bounded before parsing. Malformed origins are rejected, internal errors avoid logging submitted content, and existing type/lint errors were corrected with explicit types.
- Existing enquiry rate limiting remains per process. A shared limiter/WAF and durable delivery/storage are still required for a multi-instance production deployment. Vercel temporary files are not durable. Configure the existing HTTPS enquiry webhook before relying on enquiry delivery; API responses explicitly distinguish local save and forwarding.

## Consultation: deliberately frontend only

User-confirmed settings: free, 30 minutes, Monday–Friday, 09:00–21:00 **Asia/Karachi**, phone or video. Last start is 20:30.

Implemented: format/date/time preference, weekday and past-time validation, name, email, international phone, residence, visa category, short enquiry, privacy acknowledgement, editable review and clear/reset. The displayed times are explicitly preferences, not live availability. No booking POST, database write, email, reference number or simulated confirmation occurs. Personal details stay in component memory and are not sent to analytics or third parties.

Before live booking can be enabled, implement a server-only provider/database adapter with:

1. Confirmed consultant/resource identity, working calendar, holidays, exceptions, buffers and capacity. The weekday hours alone are not real availability.
2. Availability retrieval and server-side validation against that source. Store UTC instants and retain the Asia/Karachi schedule zone.
3. Durable booking storage with transactional slot-conflict protection and an idempotency key/unique constraint. Add shared rate limiting and spam protection.
4. Authenticated administration, retention/access policies and consent for the selected provider.
5. A real notification provider, verified sending domain, business recipient and phone/video meeting instructions. Only claim email delivery after provider acceptance; document its delivery limitations.
6. End-to-end tests for success, conflicting slots, retries, provider failures, timezone conversion and cancellation/rescheduling if supported.

No booking credentials are needed for the current frontend. Backend/provider work was explicitly deferred by the user.

## Discovered tool inventory

Discovery covered [Migration Republic](https://migrationrepublic.com.au/), its [employer page](https://migrationrepublic.com.au/employer-sponsored-visas-australia/), [tools portal](https://immigrationagentnearme.com/tools), and linked occupation pages. The portal lists seven tools; an eighth interactive occupation search was found outside the portal. The general skilled-occupation article is informational, rather than another calculator.

| Reference URL | Observed input/flow and output boundary | Implemented route |
| --- | --- | --- |
| https://immigrationagentnearme.com/tools/pr-calculator | Seven stages: age, English, overseas/Australian employment, qualification, Australian study, partner; results are gated by contact submission | `/tools/pr-calculator` — official factors plus specialist education, regional study, Professional Year, NAATI and conditional nomination, capped employment breakdown |
| https://immigrationagentnearme.com/tools/visa-quiz | Four stages: goal, skilled background, funds, partner; result contact gate | `/tools/visa-quiz` — conditional pathway guidance, circumstances, employer, study, onshore restrictions and missing evidence |
| https://immigrationagentnearme.com/tools/eligibility-checker | Passport, under-45 question, English, qualification, character; result contact gate | `/tools/eligibility-checker` — self-reported criteria separated into appears met, attention and verification; no universal six-month passport rule or automatic character refusal |
| https://immigrationagentnearme.com/tools/subclass-482-checker | Eight-stage form; sponsor, occupation, experience/recency/employment type, English, qualification, assessment, location/visa history; public questions and client assets inspected | `/tools/subclass-482-checker` — stream-aware experience, occupation, salary, English and evidence checks; Labour Agreement conditions kept separate |
| https://immigrationagentnearme.com/tools/business-sponsor-checker | Eight questions: sponsor status, trading/compliance, position, salary, capacity, recruitment, location; consent/contact gate | `/tools/business-sponsor-checker` — 482/186/494 business readiness, regional certification, TRT and agreement conditions |
| https://immigrationagentnearme.com/tools/sponsorship-cost-estimator | Four-stage subclass/business/duration setup; itemized output gated by business/contact fields | `/tools/sponsorship-cost-estimator` — government employer costs, SAF turnover/duration and separate applicant-cost link; no invented professional fee |
| https://immigrationagentnearme.com/tools/applicant-cost-calculator | Two-stage subclass/family setup; itemized output behind contact gate | `/tools/applicant-cost-calculator` — 482/186/494 standard and eligible Pacific-regional first-instalment components, adult/child charges and exclusions |
| https://migrationrepublic.com.au/core-skills-occupation-list-csol/ | Search by occupation or ANZSCO; reference page showed 187 entries | `/tools/occupation-search` — 456 official entries from each applicable instrument, search, pagination, 482 caveats and 186 assessing authorities/caveats |

No personal information was submitted to the reference sites to unlock their results. Their gated outputs were not represented as verified. Our calculations are independent implementations using the official sources below. No reference UI, testimonial, fee logic or proprietary backend was copied. All our tool outputs are available without a lead-capture requirement.

## Official rules and data

- [189 points table](https://immi.homeaffairs.gov.au/supporting/Pages/Work/189-points-table.aspx), [190 table](https://immi.homeaffairs.gov.au/supporting/Pages/Work/190-points-table.aspx), [491 table](https://immi.homeaffairs.gov.au/supporting/Pages/Work/491-points-table.aspx), [EOI threshold and invitation limitations](https://immi.homeaffairs.gov.au/visas/working-in-australia/skillselect/expression-of-interest). The calculator uses one qualification, one partner category, a 20-point employment cap and 5/15 points only with relevant nomination/sponsorship confirmed.
- [Salary requirements](https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/sponsoring-workers/nominating-a-position/salary-requirements): 2026–27 CSIT/TSMIT AUD79,423; SSIT AUD146,576. No generic threshold is applied to an individual labour agreement. Market salary remains a separate requirement.
- [2026 fee amendment](https://www.legislation.gov.au/F2026L00874/asmade/text), Schedule 3 items 7, 62 and 64, effective 1 July 2026. Standard main/adult/child: 482 **4015/4015/1005**; 186 and 494 **6140/3070/1535**. Eligible Pacific-regional rates: 482 **3290/3290/825**; 186/494 **5035/2515/1260**. Eligibility for the concession must be checked; the tool does not determine passport eligibility.
- [Sponsor costs](https://immi.homeaffairs.gov.au/visas/employing-and-sponsoring-someone/sponsoring-workers/learn-about-sponsoring/cost-of-sponsoring), [SAF legislation](https://www.legislation.gov.au/F2018L01092/latest/text) and Migration Regulations regulation 5.37 govern employer estimates. Existing-holder replacement nominations, exemptions, payment surcharges, refunds and professional fees are outside the standard estimate.
- [Official Visa Pricing Estimator](https://immi.homeaffairs.gov.au/visas/visa-pricing-estimator) is the final fee cross-check. This implementation excludes second instalments, subsequent temporary application/non-internet charges, health/testing costs and other special cases, and says so alongside the result.
- Occupations: [482 latest instrument](https://www.legislation.gov.au/F2024L01620/latest), compilation **7 November 2025**, and [186 latest instrument](https://www.legislation.gov.au/F2024L01618/latest), compilation **28 March 2026**. Data was extracted from their official HTML tables; all 456 codes match, are unique, and every caveat resolves to its relevant instrument. Inclusion alone is not visa eligibility. Current amendments must be checked before reliance.
- [BIIP closure](https://immi.homeaffairs.gov.au/visas/getting-a-visa/biip-closure-and-refunds): the quiz does not suggest a new subclass 188 application.

Some Home Affairs pages blocked direct browser retrieval or returned JavaScript shells. Indexed official text and Federal Register documents were used for verification, rather than substituting third-party fee claims. These are dated local rule snapshots, not a live Home Affairs API. Recheck on policy changes; the fee/salary guard withholds results after 30 June 2027.

## Verification and limitations

Automated tests cover motion lifecycle/reduced motion, PR factors/boundaries/caps, invalid answers, conditional fields, independent fee examples, stream-specific thresholds, rollover, occupation search/caveats, consultation validation and bounded requests. Browser checks cover real contact/wizard POSTs to isolated local storage, failure/retry paths, existing country tabs, dropdowns/drawer, metadata, JSON-LD syntax, status codes, internal links, mobile overflow and new frontend flows. No outbound notification provider was used for QA.

Final verification passed: production build (37 generated entries), TypeScript, lint, 22 automated tests, 31 public sitemap pages, and 24 tool flows across 1440px, 390px and 320px. Consultation review passed at those three widths with zero booking POSTs. Browser reports contain no broken links or hydration errors. Hero source selection and horizontal overflow were checked separately at 320, 390, 412, 430, 480, 768 and 1440px; the original and mobile source crop decode to identical pixels.

Local Lighthouse results are lab measurements, not production/field Core Web Vitals. The recorded baseline was taken on 10 October and final measurements on 12 October on this machine. Changes in machine load and image-cache state affect comparisons. INP, Google indexing, Search Console ownership and rankings require external access or real-user data and have not been claimed.

| Mobile lab metric | Recorded baseline | Final mobile-source run | Follow-up with warm image cache |
| --- | ---: | ---: | ---: |
| Performance score | 82 | 63 | 86 |
| Accessibility | 97 | 100 | Not rerun |
| Best practices | 100 | 100 | Not rerun |
| SEO | 100 | 100 | Not rerun |
| FCP | 1.10s | 1.81s | 1.07s |
| LCP | 4.42s | 4.48s | 4.12s |
| CLS | 0 | 0 | 0 |
| Total blocking time | 50.5ms | 674ms | 85.5ms |
| Transferred page bytes | 666,798 | 575,867 | 575,860 |

The page transfers about 14% fewer bytes. The follow-up improves the recorded performance score and LCP relative to the baseline, but the two final runs show substantial variation and do not establish a reliable field improvement. The LCP target of 2.5 seconds has not been met, and TBT is not a substitute for measured INP. Existing visuals and useful motion were retained. Image encoding/cache state and main-thread work need further production investigation; no claim of passing all Core Web Vitals is made. The final lab artifacts are `docs/seo-final-mobile-crop.json` and `docs/seo-final-mobile-crop-warm.json`.

`npm audit --omit=dev` reports zero production vulnerabilities. The development ESLint dependency chain reports five high advisories involving braces/micromatch/fast-glob. Published braces 3.0.3 remained affected at inspection; the offered audit fix downgrades eslint-config-next to an incompatible major. No unsafe forced downgrade was performed. Recheck upstream releases before installing tooling for untrusted repositories.

Live domain check: HTTPS returns 200 from Hostinger/PHP; HTTP redirects 301 to HTTPS. That is a different site from this local Next.js application. Connect the confirmed domain to the intended Next.js deployment, then verify production headers, canonical redirects (including www), assets, sitemap and Search Console. A Git push alone does not establish that the confirmed domain runs this code.

Local full-resolution screenshots, reference observations and audit JSON remain in ignored `docs/`; they are not included in Git or the production bundle.

## Form control styling — 12 October 2026

Tools and the 2-minute Visa Assessment now share rounded controls, teal focus/hover states, a styled picker panel and a selected-option checkmark. Existing native select elements, values, labels, validation and form events are preserved. No dropdown library or additional client JavaScript was introduced.

The full picker styling uses [customizable native selects](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select) inside a CSS support query. Supporting browsers display the themed options panel; other browsers retain their native popup and receive the styled closed control. Reduced-motion preferences disable the new transitions.

Chrome 155 checks passed at 1440px, 390px and 320px: open picker appearance, arrow-key selection, Enter, Escape, an independently expected 80-point calculator result, assessment validation, conditional fields and back-navigation value preservation. No horizontal overflow or browser page errors were recorded. Local screenshots and results: `docs/verification/dropdown-*.png` and `dropdown-report.json`.

## Content separation and shared service pages

Existing business content now lives in `src/content/`, with one source per domain.
`src/lib/constants.ts` keeps technical site configuration and compatibility
re-exports. Consumers import directly from the relevant content module; company
details, services, media paths and descriptions are not copied into a second store.

`src/components/pages/ServicePage.tsx` is the shared layout for every service.
`src/app/services/[slug]/page.tsx` handles lookup, metadata and routing. Optional
`intro`, `heading`, `sections` and SEO fields support longer service-specific copy,
paragraphs and lists while retaining the existing page layout. Guide page copy
also uses a shared renderer. No new business or legal copy was invented.

Eight before/after route snapshots retained identical visible content, page titles,
H1s and canonical URLs. Student/partner service pages passed at 390px and 320px
without horizontal overflow or page errors. Added tests cover unique slugs, unknown
lookups, longer structured content, safe text rendering, default shared content and
SEO overrides. Content editing instructions are tracked at `src/content/README.md`.
## Service layouts — 12 October 2026

Services listing now follows the requested Visaco Visa Style Three composition: three-column rounded white cards, wave-cut existing business photographs, icons and per-service Know More links. Shared service details follow the Visa Details composition with a left service menu, highlighted current service, teal contact panel, real guide links and a right image/content column. Existing brand palette, content, header and other routes remain intact. No fictitious downloads or demo business copy added. Existing photo fallback can be overridden with the optional `image` key in `src/content/services.ts`.

Desktop/mobile browser checks: 1440, 390 and 320 pixels; 10 listing links, all service photos loaded after scrolling, no horizontal overflow or page errors. Existing 25 tests and TypeScript pass. Production build and lint checked. Changes remain local; no push.

## Supplied Parent Visa article — 12 October 2026
Mapped Aged Parent Visa Subclass 804.docx to /services/parent-visa. Existing Parent Visa catalogue, header, shared service design and other services preserved. Imported 19 sections, 13 FAQ questions and 10 ordered application steps. Long copy isolated in src/content/service-pages/aged-parent-804.ts with server route resolution; not loaded in client navbar data. Added shared ordered content blocks and real links.

Editorial corrections: fixed the incorrect two-of-four balance-of-family example; removed unverified practitioner fee totals and obsolete 29–33-year waiting estimates in favor of official estimator/queue links; corrected queue-date/lodgement-date distinction; removed unsupported health-waiver implication and ambiguous assurance figures; updated application step to ImmiAccount; replaced consultation placeholders with real contact enquiry links, not a fake live booking. Source file itself unchanged. This is not a comprehensive legal approval of supplied copy.

Verified 1440/390/320 layouts without overflow or browser errors, 19 sections/13 FAQs/10 steps, no placeholder links or stale quoted fee totals. TypeScript, lint, 25 tests and production build passed. No push.

## Shared subclass reference layout — 12 October 2026

Implemented the supplied HTML layout direction as a reusable React server component, `VisaArticlePage.tsx`, with Migration Factor colours, existing local Manrope font, existing image slots and supplied Word-document copy. Includes image/text introduction, subclass tags, section labels, information cards, numbered steps, accessible native FAQ disclosures, section navigation, relevant local tools, official source links, related visa links and the existing illustrated CTA banner. The pasted competitor scripts/JSON-LD/business claims/external tool links are not executed or copied.

Imported 12 unique documents covering 804; 143/173/864/884; 858; 309/100; 820/801; 300; 189; 190; 491; 870; 500; and 600. Four `(1)` copies are text-identical and remain untouched. The existing /services/parent-visa route retains the 804 guide; eleven additional article routes were added. Original category routes remain available and now link to their related subclasses. Long copy stays in server article modules, separated from client navigation data.

Previously reviewed 804 editorial corrections preserved. Removed the explicitly unverified pre-July 858 fee paragraph and superseded contributory-parent waiting estimates in favour of official guidance; consultation placeholders use working contact enquiry links. Other supplied business copy remains intact. This is not a claim that every legal statement in every supplied document has had independent legal review.

Validation: TypeScript and lint clean; 27 tests passed; production build generated 48 entries. All 12 pages returned 200 at 1440, 390 and 320 pixels (36 browser cases), with one H1, matching canonicals, valid JSON-LD syntax, loaded images, no horizontal overflow or page errors and keyboard-operated FAQs. Internal links, unique metadata and sitemap entries separately checked. Changes remain local; no commit or push.

### Supplied subclass design alignment — 13 October 2026
- Replaced approximate subclass styling with the supplied pv-* CSS measurements and shared React structure; adapted palette to Migration Factor teal and retained the existing brand font, local images and visa-specific content.
- Restored compact headings/labels, side-by-side introduction, glass panels, vertical numbered steps, open FAQ rows, tool cards, centered CTA and related links. Four-visa comparison uses existing document text in a responsive table.
- Scope: shared subclass renderer and stylesheet; header, footer and illustrated CTA retained. No push performed.
- Verified: TypeScript, lint, 27 tests, production build (48 entries), all 12 subclass routes at 1440/390/320px, no horizontal overflow or page errors, loaded images, valid JSON-LD, 30 internal links, 12 unique titles/canonicals and sitemap entries.
- Browser comparison of supplied CSS against brand-adapted CSS confirms matching typography dimensions, spacing and card geometry at 1440/390px. Page height/content naturally differs by each visa document; this is not a pixel-identity claim against competitor copy.
- Local QA evidence: docs/reference-geometry-report.json, docs/subclass-browser-report.json and docs/reference-*.png (ignored).

### Pre-push verification — 13 October 2026
Main service overviews now reuse relevant imported article copy while retaining the separate service design. Subclass paths use the shared visaPath helper; ten old flat URLs permanently redirect to nested URLs. Production checks passed for all twelve article routes, ten category services, redirects, canonical/sitemap consistency and three unknown-route 404s. Twelve desktop/mobile production browser cases passed without overflow or page errors. Lint, twenty-seven tests and production build (48 entries) passed. User explicitly authorized pushing this work.

### Tool headings and SEO content — 13 October 2026
All eight public tool pages now have unique server-rendered introductions, usage steps, result explanations and relevant internal links in src/content/tools.ts. ToolGuide.tsx renders the shared editorial sections without adding client-side state. Page-specific titles/descriptions feed canonical, Open Graph and Twitter metadata; visible and JSON-LD breadcrumbs now include the tools directory. Directory and occupation cards use H3 under relevant H2 sections. Existing calculations, privacy behaviour and rule-verification dates are retained.
The approach follows Google Search Central guidance on descriptive titles and meaningful links: https://developers.google.com/search/docs/appearance/title-link and https://developers.google.com/search/docs/crawling-indexing/links-crawlable . No fabricated ratings/FAQ rich-result claims or ranking guarantees were added.
Verified: TypeScript, lint, 27 tests and production build (48 entries). Current dev-preview browser verification passed 24 cases (8 tools at 1440/390/320px), unique metadata, canonical/OG/Twitter consistency, three-part breadcrumbs, sitemap coverage, valid JSON-LD, server-rendered editorial content, internal links, no horizontal overflow or page errors. PR validation, independent 110-point scenario and recalculation to 90 after editing English, and ANZSCO 261313 occupation search also passed. Local QA: docs/tools-seo-report.json and tools-seo-*.png. Changes remain local; no push.

### Complete Student Visa service content — 14 October 2026
The main /services/student-visa page previously displayed only an overview, while the full supplied Student Visa Subclass 500 article was available on /services/student/visa-500. The main service resolver now reuses all four introduction paragraphs and all 23 source sections, including documents, application steps, costs and FAQs. The main page retains its existing service template, catalogue identity, metadata, imagery and sidebar; the subclass route retains its separate pv-* design. Source text stays in one article module. A regression test ensures the full guide resolves on the main service route. TypeScript, lint, 34 tests, production build (48 entries) and browser checks at 1440/390/320px passed, including contents links, keyboard FAQs and no overflow/page errors. Changes remain local; no push.

### Separate Student service copy and nested subclass navigation — 14 October 2026
The newly supplied student visa Study In Australia International Students.docx is copied unchanged into content-input/ and imported into src/content/service-pages/student-visa.ts (four intro paragraphs, eighteen sections and twelve FAQs). The main /services/student-visa page now uses this study-planning guide. Existing /services/student/visa-500 keeps the detailed subclass article and its pv-* design; no existing subclass article files or URLs were changed. Consultation placeholders resolve to the real contact enquiry link. RMIT is attributed for its indicative cost examples, with the master's annual/course-total wording corrected against its annual fee table. Official/source links accompany relevant sections. This is not a comprehensive legal review of the source document.
Header Services now groups all twelve existing subclass pages under six service categories. Hover opens the desktop flyout; buttons, ArrowRight/ArrowLeft and Escape support keyboard access. Flyouts stay within the viewport, including a short desktop viewport. Mobile uses nested native disclosures inside the existing contact drawer, with category overview links retained. No new visa routes were invented. Other main service overviews remain as the user clarified.
Verification: TypeScript, lint, thirty-nine tests and production build (55 entries in the current working tree) passed. Browser checks passed desktop hover/keyboard at 1440 and 1200px (540px high), mobile tap/navigation at 768/390/320px, all eighteen Student sections, no overflow/page errors, and HTTP 200 for all twelve existing guides. Local evidence: docs/student-navigation-report.json and service-submenus-*.png. No commit or push performed for this task. Unrelated in-progress admin/backend work was preserved.
