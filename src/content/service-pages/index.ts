import { getService, type Service } from '@/content/services';
import { studentVisa } from './student-visa';
import { partnerVisa } from './partner-visa';
import { businessMigration } from './business-migration';
import { humanitarianProtection } from './humanitarian-protection';
import { parentVisa } from './parent-visa';
import { skilledVisa } from './skilled-visa';
import { australianCitizenship } from './australian-citizenship';
import { employerSponsoredVisa } from './employer-sponsored-visa';

// Main service documents only. Subclass guides have their own resolver and URLs.
const articles: Record<string, Pick<Service, 'heading' | 'intro' | 'sections' | 'sourceNote' | 'seo'>> = {
  'student-visa': studentVisa,
  'partner-visa': partnerVisa,
  'business-migration': businessMigration,
  'humanitarian-protection': humanitarianProtection,
  'parent-visa': parentVisa,
  'skilled-visa': skilledVisa,
  'australian-citizenship': australianCitizenship,
  'employer-sponsored-visa': employerSponsoredVisa,
};

/** Resolve long article copy only in server page routes, not the shared navbar catalogue. */
export function getServicePage(slug: string) {
  const service = getService(slug);
  if (!service) return undefined;
  return articles[slug] ? { ...service, ...articles[slug] } : service;
}
