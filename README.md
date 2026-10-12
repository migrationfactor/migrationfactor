# Migration Factor

A single Next.js 16 App Router application, running directly from this project root. The approved website UI, business content and animations are preserved.

## Commands

```powershell
npm install
npm run dev
npm run build
npm start
npm run typecheck
npm test
npm run lint
```

The server prints its local URL (normally http://localhost:3000). Vercel uses the root Next.js application and default build output. There is one package.json, package-lock.json, public directory and src directory.

## Component-based structure

```text
src/
  app/                 Pages, layouts, metadata and API routes
  components/
    layout/            Header, Footer, Breadcrumb and header controller
    sections/          Homepage/service sections, forms and assessment
    shared/            Motion, word reveals, animated counter and JSON-LD
    booking/           Consultation preference and review frontend
    tools/             Migration calculators, checklists and occupation search
    ui/                Reusable buttons, headings, images and icons
  features/            Independent consultation validation and migration rules/data
  content/             Editable company, home, services, countries, coaching and guide copy
  lib/                 SEO, validation, enquiry/assessment logic and config compatibility
  styles/              Approved site, restoration, motion and assessment CSS
public/                Media, brand assets, fonts and supplied originals
tests/                 Animation, rules, fee, occupation and form validation tests
scripts/               Optional browser verification
docs/                  Local audit artifacts (ignored by Git)
```

Page files compose the existing reusable components. Update shared components at their source and preserve approved visuals. No nested nextjs-app or legacy static generator is required.

## Editing content and service pages

Edit website copy under `src/content/`. The existing design stays in components.
See [the content editing guide](src/content/README.md) for the file map and examples.

All service pages share `src/components/pages/ServicePage.tsx`. The dynamic
`src/app/services/[slug]/page.tsx` route looks up the service from
`src/content/services.ts`. Add longer `intro`, `sections`, paragraphs and bullet
lists to a service entry without creating a separate page design. New catalogue
entries also feed service listings, menus, enquiry options and the sitemap.

## Enquiries

The contact form and Visa Assessment submit JSON to /api/enquiries. /api/config reports whether forwarding is configured. The assessment collects a profile and presents existing guidance; it does not calculate visa eligibility.

Copy .env.example to .env.local for local configuration. DATA_DIR overrides private enquiry storage. Otherwise local enquiries are stored in data/enquiries.ndjson. On Vercel, temporary filesystem storage is not durable; configure ENQUIRY_WEBHOOK_URL for external delivery, with optional ENQUIRY_WEBHOOK_TOKEN. The response reports actual delivery status. Never commit enquiry records or environment secrets.

## Tools and consultation

`/tools` links to eight free tools, including CSOL occupation search. Calculation logic, validation, source links and the official occupation snapshot are under `src/features/immigration-tools/`. Review legal data before each fee year and whenever official requirements change. The fee and salary tools withhold calculations after 30 June 2027 until their data is refreshed.

`/consultation` is intentionally **frontend only**, as requested. It supports a free 30-minute phone/video consultation preference, Monday–Friday, 9am–9pm in `Asia/Karachi`, validation, editing and review. It does not reserve availability, save a booking, send an email or issue a confirmation. Details remain only in component memory. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for the integration work required before enabling real bookings.

SEO canonicals use `https://migrationfactor.com`. The domain currently serves a separate Hostinger site; connect it to the Next.js deployment before treating these local changes as live there.

Run the optional browser audit with `QA_MODULE` set to an installed `puppeteer-core` module, `CHROME_PATH` set to Chrome if it differs from the script default, and `QA_URL` set to a running production preview. Run `node scripts/verify-site.mjs`. It writes local results to ignored `docs/verification/`.
