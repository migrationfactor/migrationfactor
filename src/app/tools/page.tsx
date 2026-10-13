import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import JsonLd from '@/components/shared/JsonLd';
import { allTools as tools } from '@/features/immigration-tools/catalog';
import { pageMetadata, pageSchema } from '@/lib/seo';
import '@/styles/features.css';
const title = 'Free Australian Visa and Migration Tools';
const description = 'Explore free Australian PR points, visa eligibility and cost calculators, a visa pathway quiz and CSOL occupation search to prepare your next step.';
export const metadata = pageMetadata('/tools', title, description);
export default function ToolsPage() {
  return <><JsonLd data={pageSchema('/tools', title, description)} /><Breadcrumb name={title} desc="Understand your options, one step at a time." /><section className="section"><div className="container"><header className="tool-directory-intro"><h2>Calculators and checkers to help plan your Australian visa pathway</h2><p>Estimate skilled migration points, explore visa options, review employer sponsorship or plan government charges. Choose the tool that matches the question you want to investigate.</p></header><p className="feature-note">Free tools to help you prepare. Calculations and checklists are preliminary guidance; they do not replace an individual assessment. Your answers stay in your browser page.</p><div className="tool-directory">{tools.map((tool, i) => <article key={tool.slug} className="tool-card"><span className="tool-number">0{i + 1} / MIGRATION TOOLS</span><h3>{tool.name}</h3><p>{tool.description}</p><Link className="tool-link" href={`/tools/${tool.slug}`}>Open {tool.name} →</Link></article>)}</div></div></section></>;
}
