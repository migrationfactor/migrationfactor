import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ServicePage from '@/components/pages/ServicePage';
import VisaArticlePage from '@/components/pages/VisaArticlePage';
import { getVisaArticle } from '@/content/visa-subclasses';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import { services, getServiceSeo } from '@/content/services';
import { getServicePage } from '@/content/service-pages';
import { pageMetadata } from '@/lib/seo';
import { splitVisaSlug, visaPath } from '@/lib/visa-path';
interface PageProps { params: Promise<{ slug: string }> }
export const dynamicParams = false;
export function generateStaticParams() { return [...new Set([...services, ...visaSubclasses].map(service => service.slug))].filter(slug => !splitVisaSlug(slug)).map(slug => ({ slug })); }
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getVisaArticle(slug) ?? getServicePage(slug);
  if (!service) return {};
  const seo = getServiceSeo(service);
  return pageMetadata(visaPath(slug), seo.title, seo.description);
}
export default async function ServiceRoute({ params }: PageProps) {
  const { slug } = await params;
  const visa = splitVisaSlug(slug) ? undefined : getVisaArticle(slug);
  if (visa) return <VisaArticlePage visa={visa} />;
  const service = getServicePage(slug);
  if (!service) notFound();
  return <ServicePage service={service} />;
}
