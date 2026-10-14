# Editing website content

Content lives here; design lives in `src/components/`. Photos stay in `public/media/`.

| File | Edit here |
| --- | --- |
| `company.ts` | Name, contact details, offices, overview, mission and vision text |
| `home.ts` | Hero, homepage pathway cards, working steps and CTA copy |
| `about.ts` | About page labels/headings, checks and mission/vision presentation |
| `services.ts` | Service summaries and optional longer service-page content |
| `countries.ts` | Country descriptions and destination links |
| `coaching.ts` | IELTS/PTE programmes and homepage coaching cards |
| `guides.ts` | Guide paragraphs/lists and their homepage cards |
| `faqs.ts` | Questions and answers |
| `media.ts` | Photo paths, alt text and image dimensions |
| `navigation.ts` | Shared menu entries |
| `service-navigation.ts` | Service-to-subclass menu links derived from the existing service and subclass catalogues |
| `service-pages/student-visa.ts` | Main Student Visa page: supplied study-in-Australia guide; separate from subclass 500 requirements |
| `tools.ts` | Tool SEO titles/descriptions, introductions, instructions, result explanations and related links; calculator rules remain in `src/features/immigration-tools/` |

## One service design, different content

```text
src/content/services.ts
          ↓ slug lookup
src/app/services/[slug]/page.tsx
          ↓ service data
src/components/pages/ServicePage.tsx
```

Each service entry has `slug`, `name`, `icon`, `group` and a short `description`.
That description appears in cards and default SEO metadata. For longer page text,
add `intro` and `sections` to the same entry. The shared component renders every
service using the same approved design, sidebar and process section.

Here is the shape of **one section** (replace the example words with your real copy;
this example is not displayed anywhere on the website):

```ts
sections: [
  {
    id: 'documents',
    heading: 'Your section heading',
    paragraphs: ['First paragraph.', 'Second paragraph.'],
    items: ['First list item.', 'Second list item.'],
  },
]
```

- Add as many sections/paragraphs/list items as you need. Text is rendered safely;
  do not paste raw HTML into these strings.
- `intro: ['...']` replaces the short description in the main page body only.
- `heading` optionally overrides the main article heading.
- `seo: { title: '...', description: '...' }` optionally overrides page metadata.
- Without custom sections, the existing shared next-step copy is used.
- Add a new entry to `services` and rebuild: the dynamic route, services listing,
  service menus, sidebar, enquiry options and sitemap use that same catalogue.
- Keep existing slugs unless you also set up redirects for the old URLs.

For example, `slug: 'student-visa'` serves `/services/student-visa`; the same page
component serves `/services/partner-visa` with the partner service's content.
No separate service-page design file is needed.

`src/lib/constants.ts` contains the site URL and compatibility re-exports only.
It does not contain a second copy of the business content. Immigration tool rules,
fees and consultation scheduling stay in their existing `src/features/` modules.

After edits, run `npm run typecheck` and `npm run build`, then review the affected
route. Verify legal requirements before publishing new immigration guidance.

Main service articles live in `src/content/service-pages/`. The main Student Visa page uses its separate study-planning article. Other main services use their existing company summaries until their own long content is supplied. Do not fill main services with subclass article excerpts. The short catalogue remains in `services.ts`, keeping long page text out of navbar/client imports.

## Subclass content pages

All unique Word files supplied in `content-input/` use one shared component: `src/components/pages/VisaArticlePage.tsx`. The supplied HTML controls the layout direction only; its Migration Republic business copy, script blocks, schema, fonts and demo colours are not imported.

Edit page copy in `src/content/visa-subclasses/<slug>.ts`; summary, existing image slot and category mapping are in `catalog.ts`. Reviewed Subclass 804 content lives in `visa-subclasses/aged-parent-visa-804.ts`. The server-only resolver in `visa-subclasses/index.ts` combines the article with the short catalogue. Do not import that resolver into navbar/client components. Original Word files and identical duplicate copies remain untouched.

To add a subclass, add its summary and content, register it in `index.ts`, then build. Shared routing and sitemap use the catalogue. `/services/parent-visa` is the Parent Visa category; the full 804 guide is at `/services/aged-parent/subclass-visa-804`. All twelve subclass guides have distinct URLs from the ten main services. Nested Services menus and related links use the same catalogue.
