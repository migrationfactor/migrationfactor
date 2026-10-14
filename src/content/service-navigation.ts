import { services } from './services';
import { visaSubclasses } from './visa-subclasses/catalog';
import { visaPath } from '@/lib/visa-path';

/** Link to existing guides only; no article content belongs in the client header. */
export const serviceNavigation = services.map(service => ({
  slug: service.slug,
  label: service.name,
  href: `/services/${service.slug}/`,
  children: visaSubclasses.filter(visa => visa.parentSlug === service.slug).map(visa => ({
    label: visa.name,
    href: visaPath(visa.slug),
  })),
}));
