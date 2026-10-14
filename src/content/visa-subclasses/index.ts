import { visaSubclasses } from './catalog';
import { agedParent804 } from './aged-parent-visa-804';
import type { VisaArticleContent, VisaArticle } from './types';
import article0 from './contributory-parent-visa';
import article1 from './national-innovation-visa-858';
import article2 from './offshore-partner-visa-309-100';
import article3 from './onshore-partner-visa-820-801';
import article4 from './prospective-marriage-visa-300';
import article5 from './skilled-independent-visa-189';
import article6 from './skilled-nominated-visa-190';
import article7 from './skilled-work-regional-visa-491';
import article8 from './sponsored-parent-visa-870';
import article9 from './student-visa-500';
import article10 from './visitor-visa-600';

const articles: Record<string, VisaArticleContent> = {
 'aged-parent-visa-804': agedParent804,
 'contributory-parent-visa-143-173-864-884': article0,
 'national-innovation-visa-858': article1,
 'offshore-partner-visa-309-100': article2,
 'onshore-partner-visa-820-801': article3,
 'prospective-marriage-visa-300': article4,
 'skilled-independent-visa-189': article5,
 'skilled-nominated-visa-190': article6,
 'skilled-work-regional-visa-491': article7,
 'sponsored-parent-visa-870': article8,
 'student-visa-500': article9,
 'visitor-visa-600': article10,
};
export function getVisaArticle(slug: string): VisaArticle | undefined {
 const summary = visaSubclasses.find(visa => visa.slug === slug);
 return summary ? { ...summary, ...articles[slug] } : undefined;
}
