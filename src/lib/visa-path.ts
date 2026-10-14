/** Subclass slugs such as `student-visa-500` are served at `/services/student/subclass-visa-500`. */
const SUBCLASS_SLUG = /^(.+?)-(visa-\d+(?:-\d+)*)$/;
const SEGMENT_PREFIX = 'subclass-';

export function splitVisaSlug(slug: string): [string, string] | undefined {
  const match = SUBCLASS_SLUG.exec(slug);
  return match ? [match[1], `${SEGMENT_PREFIX}${match[2]}`] : undefined;
}

/** Maps `/services/[slug]/[sub]` URL segments back to the subclass slug. */
export function visaSlugFromPath(slug: string, sub: string) {
  return sub.startsWith(SEGMENT_PREFIX) ? `${slug}-${sub.slice(SEGMENT_PREFIX.length)}` : undefined;
}

export function visaPath(slug: string) {
  const parts = splitVisaSlug(slug);
  return `/services/${parts ? parts.join('/') : slug}`;
}

/** Earlier public addresses of a subclass guide, kept as permanent redirects. */
export function legacyVisaPaths(slug: string) {
  const parts = splitVisaSlug(slug);
  if (!parts) return [];
  return [`/services/${slug}`, `/services/${parts[0]}/${parts[1].slice(SEGMENT_PREFIX.length)}`];
}
