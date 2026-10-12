// Technical configuration. Business content lives in src/content/.
export const SITE_URL = 'https://migrationfactor.com';

// Compatibility exports keep existing integrations working; no content is duplicated.
export { company } from '@/content/company';
export { navigation } from '@/content/navigation';
export { services } from '@/content/services';
export { steps } from '@/content/home';
export { countries } from '@/content/countries';
export { coaching } from '@/content/coaching';
export { faqs } from '@/content/faqs';
export { images } from '@/content/media';
export type { Service } from '@/content/services';
export type { Country } from '@/content/countries';
export type { CoachingProgram } from '@/content/coaching';
export type { ImageMeta } from '@/content/media';
