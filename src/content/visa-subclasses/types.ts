import type { Service } from '@/content/services';

export interface VisaSummary extends Service {
  shortName: string;
  subclasses: string[];
  parentSlug: string;
  officialUrl: string;
}
export type VisaArticleContent = Required<Pick<Service, 'heading' | 'intro' | 'sections' | 'sourceNote' | 'seo'>>;
export type VisaArticle = VisaSummary & VisaArticleContent;
