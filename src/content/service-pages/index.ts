import { getService } from '@/content/services';
import { agedParent804 } from './aged-parent-804';
import { getServiceOverview } from './overviews';

/** Resolve long article copy only in server page routes, not the shared navbar catalogue. */
export function getServicePage(slug: string) {
  const service = getService(slug);
  if (!service) return undefined;
  return slug === 'parent-visa' ? { ...service, ...agedParent804 } : getServiceOverview(service) ?? service;
}
