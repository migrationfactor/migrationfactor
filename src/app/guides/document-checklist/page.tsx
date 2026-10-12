import { notFound } from 'next/navigation';
import GuidePage from '@/components/pages/GuidePage';
import { getGuide } from '@/content/guides';
import { pageMetadata } from '@/lib/seo';

const guide = getGuide('document-checklist');
export const metadata = guide ? pageMetadata('/guides/document-checklist', guide.seo.title, guide.seo.description) : {};
export default function Page() {
  if (!guide) notFound();
  return <GuidePage guide={guide} />;
}
