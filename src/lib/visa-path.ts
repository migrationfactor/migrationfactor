/** Subclass slugs such as `student-visa-500` are served at `/services/student/visa-500`. */
const SUBCLASS_SLUG = /^(.+?)-(visa-\d+(?:-\d+)*)$/;

export function splitVisaSlug(slug: string): [string, string] | undefined {
  const match = SUBCLASS_SLUG.exec(slug);
  return match ? [match[1], match[2]] : undefined;
}

export function visaPath(slug: string) {
  const parts = splitVisaSlug(slug);
  return `/services/${parts ? parts.join('/') : slug}`;
}
