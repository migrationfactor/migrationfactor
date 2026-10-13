import type { Service, ServiceBlock, ServiceSection } from '@/content/services';
import { getVisaArticle } from '@/content/visa-subclasses';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import type { VisaArticle } from '@/content/visa-subclasses/types';
import { visaPath } from '@/lib/visa-path';

/**
 * Main service pages keep their own design. Their long copy is drawn from the
 * supplied Word articles of the subclasses in that category, so the text stays
 * identical to the source and is edited in one place.
 */
const OVERVIEW_HEADINGS = [/^What the .+ Is$/, /^Who the Visa Is For$/, /^Who Can Apply and Eligibility Requirements$/, /^Eligibility Requirements at a Glance$/];

const isOverview = (section: ServiceSection) => OVERVIEW_HEADINGS.some(pattern => pattern.test(section.heading));
const withoutConsultation = (paragraphs: string[]) => paragraphs.filter(text => !text.includes('{{consultation}}'));
const guideLink = (visa: VisaArticle) => ({ label: `Read the full ${visa.name} guide`, href: visaPath(visa.slug) });

function singleOverview(service: Service, visa: VisaArticle): Service {
  const sections = visa.sections.filter(isOverview).map((section, index, all): ServiceSection => ({ ...section, links: index === all.length - 1 ? [guideLink(visa)] : undefined }));
  return { ...service, heading: `${visa.shortName} support`, intro: withoutConsultation(visa.intro).slice(0, 2), sections, sourceNote: visa.sourceNote };
}

function categoryOverview(service: Service, visas: VisaArticle[]): Service {
  const sections = visas.map((visa): ServiceSection => {
    const blocks: ServiceBlock[] = [{ type: 'paragraph', text: withoutConsultation(visa.intro)[0] }];
    for (const section of visa.sections.filter(isOverview)) blocks.push({ type: 'heading', text: section.heading }, ...(section.blocks ?? []));
    return { id: visa.slug, heading: visa.name, blocks, links: [guideLink(visa)] };
  });
  return { ...service, intro: [service.description], sections, sourceNote: visas[0].sourceNote };
}

export function getServiceOverview(service: Service): Service | undefined {
  const visas = visaSubclasses.filter(visa => visa.parentSlug === service.slug && visa.slug !== service.slug).map(visa => getVisaArticle(visa.slug)).filter((visa): visa is VisaArticle => !!visa);
  if (!visas.length) return undefined;
  return visas.length === 1 && visas[0].shortName === service.name ? singleOverview(service, visas[0]) : categoryOverview(service, visas);
}
