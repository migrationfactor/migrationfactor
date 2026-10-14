import { getService } from '@/content/services';
import { studentVisa } from './student-visa';

/** Resolve long article copy only in server page routes, not the shared navbar catalogue. */
export function getServicePage(slug: string) {
  const service = getService(slug);
  if (!service) return undefined;
  if (slug === 'student-visa') return { ...service, ...studentVisa };
  // Category pages use their own business content, never a subclass article excerpt.
  return service;
}
