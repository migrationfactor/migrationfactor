import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import VisaArticlePage from '@/components/pages/VisaArticlePage';
import { getVisaArticle } from '@/content/visa-subclasses';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import { getServiceSeo } from '@/content/services';
import { pageMetadata } from '@/lib/seo';
import { splitVisaSlug, visaPath } from '@/lib/visa-path';
interface PageProps { params: Promise<{ slug: string; sub: string }> }
export const dynamicParams = false;
export function generateStaticParams() {
  return visaSubclasses.flatMap(visa => { const parts = splitVisaSlug(visa.slug); return parts ? [{ slug: parts[0], sub: parts[1] }] : []; });
}
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, sub } = await params;
  const visa = getVisaArticle(`${slug}-${sub}`);
  if (!visa) return {};
  const seo = getServiceSeo(visa);
  return pageMetadata(visaPath(visa.slug), seo.title, seo.description);
}
export default async function VisaSubclassRoute({ params }: PageProps) {
  const { slug, sub } = await params;
  const visa = getVisaArticle(`${slug}-${sub}`);
  if (!visa || visaPath(visa.slug) !== `/services/${slug}/${sub}`) notFound();
  return <VisaArticlePage visa={visa} />;
}
