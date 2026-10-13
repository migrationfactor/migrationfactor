import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import JsonLd from '@/components/shared/JsonLd';
import ImmigrationTool from '@/components/tools/ImmigrationTool';
import { allTools as tools } from '@/features/immigration-tools/catalog';
import OccupationSearch from '@/components/tools/OccupationSearch';
import { ToolIntro, ToolGuide } from '@/components/tools/ToolGuide';
import { toolContent } from '@/content/tools';
import { absoluteUrl, pageMetadata, pageSchema } from '@/lib/seo';
import '@/styles/features.css';
export const dynamicParams = false;
export function generateStaticParams() { return tools.map(tool => ({ slug: tool.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const tool = tools.find(item => item.slug === slug);
  if (!tool) return {};
  const content = toolContent[tool.slug];
  return pageMetadata(`/tools/${slug}`, content.title, content.description);
}
export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const tool = tools.find(item => item.slug === slug);
  if (!tool) notFound();
  const content = toolContent[tool.slug];
  const schema = pageSchema(`/tools/${slug}`, content.heading, content.description);
  const toolSchema = { ...schema, '@graph': schema['@graph'].map(node => node['@type'] === 'BreadcrumbList' ? { ...node, itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    { '@type': 'ListItem', position: 2, name: 'Migration Tools', item: absoluteUrl('/tools') },
    { '@type': 'ListItem', position: 3, name: content.heading, item: absoluteUrl(`/tools/${slug}`) },
  ] } : node) };
  return <><JsonLd data={toolSchema} /><Breadcrumb name={content.heading} desc={tool.description} parent={{ name: 'Migration Tools', href: '/tools' }} /><section className="section"><div className="container"><ToolIntro content={content} />{tool.slug === 'occupation-search' ? <OccupationSearch /> : <ImmigrationTool key={tool.slug} slug={tool.slug} />}<ToolGuide content={content} /></div></section></>;
}
