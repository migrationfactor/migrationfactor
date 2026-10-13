import type { IconType } from '@/components/ui/Icon';
import { images } from '@/content/media';

// Existing Migration Factor content; edit copy here without changing page components.
export interface Service {
  slug: string;
  name: string;
  icon: IconType;
  group: string;
  description: string;
  image?: keyof typeof images;
  insetImage?: keyof typeof images;
  /** Longer page copy; short description is kept for cards and metadata. */
  intro?: string[];
  heading?: string;
  sourceNote?: string;
  sections?: ServiceSection[];
  seo?: { title?: string; description?: string };
}

export interface ServiceSection {
  id?: string;
  heading: string;
  paragraphs?: string[];
  items?: string[];
  blocks?: ServiceBlock[];
  links?: { label: string; href: string }[];
}

export type ServiceBlock = { type: 'paragraph' | 'heading'; text: string } | { type: 'list'; items: string[]; ordered?: boolean };

export const servicePageContent = {
  sections: [
    { heading: 'Start with your circumstances', paragraphs: ['Prepare your basic profile: passport, age, education, work history, English result, family details and current visa status. Request an eligibility assessment and a document checklist.'] },
    { heading: 'Understand your next steps', paragraphs: ['Ask for your potential pathway, estimated timeline, professional fee and government charges in writing and separately.'] },
  ] satisfies ServiceSection[],
  sourceNote: 'Service summary based on the company report. Current requirements and availability should be confirmed with an appropriately registered migration professional.',
  button: 'Discuss this service',
  sidebarHeading: 'Explore our services',
};

export const services: Service[] = [
  {
    slug: 'student-visa',
    name: 'Student Visa',
    icon: 'study',
    image: 'studentVisa',
    insetImage: 'studentVisaInset',
    group: 'Education & travel',
    description:
      'Support for education in Australia and selected European destinations, including university selection, GTE/SOP, financial documents and visa preparation.',
  },
  {
    slug: 'visitor-visa',
    name: 'Visitor Visa',
    icon: 'globe',
    image: 'visitorVisa',
    insetImage: 'visitorVisaInset',
    group: 'Education & travel',
    description: 'Guidance for visiting Australia, family visits and travel planning.',
  },
  {
    slug: 'australian-citizenship',
    name: 'Australian Citizenship',
    icon: 'document',
    image: 'australianCitizenship',
    insetImage: 'australianCitizenshipInset',
    group: 'Education & travel',
    description: 'Guidance through the Australian citizenship application journey.',
  },
  {
    slug: 'partner-visa',
    name: 'Partner Visa',
    icon: 'people',
    image: 'partnerVisa',
    insetImage: 'partnerVisaInset',
    group: 'Family & relationships',
    description:
      'Support for partner and prospective marriage pathways, including relationship evidence, statements and sponsor documentation.',
  },
  {
    slug: 'parent-visa',
    name: 'Parent Visa',
    icon: 'people',
    image: 'parentVisa',
    insetImage: 'parentVisaInset',
    group: 'Family & relationships',
    description:
      'Guidance for aged parent, contributory parent and sponsored parent pathways.',
  },
  {
    slug: 'employer-sponsored-visa',
    name: 'Employer Sponsored Visa',
    icon: 'case',
    image: 'employerSponsoredVisa',
    insetImage: 'employerSponsoredVisaInset',
    group: 'Work & business',
    description:
      'Support for employer-sponsored pathways, including employer sponsorship, nomination and documentation.',
  },
  {
    slug: 'skilled-visa',
    name: 'GSM & Skilled Visa',
    icon: 'case',
    image: 'skilledVisa',
    insetImage: 'skilledVisaInset',
    group: 'Work & business',
    description:
      'Support with expressions of interest, points strategy and skills assessments for skilled migration pathways.',
  },
  {
    slug: 'business-migration',
    name: 'Business Migration',
    icon: 'case',
    image: 'businessMigration',
    insetImage: 'businessMigrationInset',
    group: 'Work & business',
    description:
      'The company report describes business innovation, investment and entrepreneur pathways. Ask the team to confirm current availability.',
  },
  {
    slug: 'humanitarian-protection',
    name: 'Humanitarian & Protection',
    icon: 'shield',
    image: 'humanitarianProtection',
    insetImage: 'humanitarianProtectionInset',
    group: 'Protection & reviews',
    description:
      'Support for protection, refugee, special humanitarian and emergency humanitarian cases.',
  },
  {
    slug: 'appeals-reviews',
    name: 'Appeals & Reviews',
    icon: 'document',
    image: 'appealsReviews',
    insetImage: 'appealsReviewsInset',
    group: 'Protection & reviews',
    description:
      'Support after a refusal or cancellation, including decision-letter review, evidence and written submissions. Check your deadline immediately.',
  },
];

export function getService(slug: string) { return services.find(service => service.slug === slug); }

export function getServiceImage(service: Service & { parentSlug?: string }) {
  if (service.image && images[service.image]) return images[service.image];
  if (service.parentSlug) {
    const parent = services.find(s => s.slug === service.parentSlug);
    if (parent?.image && images[parent.image]) return images[parent.image];
  }
  return images[service.slug === 'student-visa' ? 'studentVisa' : service.group === 'Work & business' ? 'skilledVisa' : 'hero'];
}

export function getServiceInsetImage(service: Service & { parentSlug?: string }) {
  if (service.insetImage && images[service.insetImage]) return images[service.insetImage];
  if (service.parentSlug) {
    const parent = services.find(s => s.slug === service.parentSlug);
    if (parent?.insetImage && images[parent.insetImage]) return images[parent.insetImage];
  }
  return images['documents'];
}

export function getServiceSeo(service: Service) {
  return {
    title: service.seo?.title ?? service.name,
    description: service.seo?.description ?? `${service.name} support from Migration Factor. ${service.description}`,
  };
}
