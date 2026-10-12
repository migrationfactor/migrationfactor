import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import CtaSection from '@/components/sections/CtaSection';
import JsonLd from '@/components/shared/JsonLd';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { getServiceImage, type ServiceBlock, type ServiceSection } from '@/content/services';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import type { VisaArticle } from '@/content/visa-subclasses/types';
import { pageSchema } from '@/lib/seo';

function Copy({ text, contact }: { text: string; contact: string }) {
  return text.split('{{consultation}}').map((part, i) => <Fragment key={i}>{i > 0 && <Link href={contact}>request a free consultation</Link>}{part}</Fragment>);
}

function Block({ block, contact }: { block: ServiceBlock; contact: string }) {
  if (block.type === 'heading') return <h4>{block.text}</h4>;
  if (block.type === 'paragraph') return <p><Copy text={block.text} contact={contact} /></p>;
  if (block.type !== 'list') return null;
  const items = block.items.map((text, i) => <li key={i}><Copy text={text} contact={contact} /></li>);
  return block.ordered ? <ol className="subclass-steps">{items}</ol> : <ul className="subclass-checklist">{items}</ul>;
}

function Faq({ blocks, contact }: { blocks: ServiceBlock[]; contact: string }) {
  return <div className="subclass-faq">{blocks.map((block, i) => {
    if (block.type !== 'heading') return null;
    const next = blocks.findIndex((item, j) => j > i && item.type === 'heading');
    return <details key={i}><summary><span className="subclass-q" aria-hidden="true">Q</span><h4>{block.text}</h4><span className="subclass-faq-toggle" aria-hidden="true">+</span></summary><div>{blocks.slice(i + 1, next < 0 ? blocks.length : next).map((answer, j) => <Block key={j} block={answer} contact={contact} />)}</div></details>;
  })}</div>;
}

function SectionBody({ section, contact }: { section: ServiceSection; contact: string }) {
  const blocks = section.blocks ?? [];
  if (/Frequently Asked Questions/i.test(section.heading)) return <Faq blocks={blocks} contact={contact} />;
  // Subsections become reusable information cards, while their text stays in document order.
  const groups: { heading?: string; blocks: ServiceBlock[] }[] = [];
  for (const block of blocks) {
    if (block.type === 'heading') groups.push({ heading: block.text, blocks: [] });
    else {
      if (!groups.length) groups.push({ blocks: [] });
      groups[groups.length - 1].blocks.push(block);
    }
  }
  return <>
    {section.paragraphs?.map((text, i) => <p key={i}><Copy text={text} contact={contact} /></p>)}
    {section.items?.length ? <Block block={{ type: 'list', items: section.items }} contact={contact} /> : null}
    {groups.filter(group => !group.heading).map((group, i) => <Fragment key={i}>{group.blocks.map((block, j) => <Block key={j} block={block} contact={contact} />)}</Fragment>)}
    <div className="subclass-info-grid">{groups.filter(group => group.heading).map((group, i) => <div className="subclass-info-card" key={i}><h4>{group.heading}</h4>{group.blocks.map((block, j) => <Block key={j} block={block} contact={contact} />)}</div>)}</div>
  </>;
}

export default function VisaArticlePage({ visa }: { visa: VisaArticle }) {
  const contact = `/contact/?service=${encodeURIComponent(visa.name)}`;
  const photo = getServiceImage(visa);
  const related = visaSubclasses.filter(item => item.slug !== visa.slug && item.parentSlug === visa.parentSlug);
  const tools = [
    ...(visa.parentSlug === 'skilled-visa' ? [{ title: 'PR Points Calculator', description: 'Calculate points for subclasses 189, 190 and 491.', href: '/tools/pr-calculator', icon: 'document' as const }] : []),
    { title: 'Visa Selection Quiz', description: 'Explore potentially relevant Australian visa pathways.', href: '/tools/visa-quiz', icon: 'globe' as const },
    ...(visa.group === 'Work & business' ? [{ title: 'Eligibility Checker', description: 'Review preliminary skilled and employer-sponsored requirements.', href: '/tools/eligibility-checker', icon: 'check' as const }] : []),
  ];
  return <>
    <JsonLd data={pageSchema(`/services/${visa.slug}`, visa.name, visa.description, 'Service')} />
    <Breadcrumb name={visa.name} desc={visa.group} />
    <section className="section subclass-section"><article className="container subclass-article">
      <header className="subclass-intro">
        <span className="subclass-label">{visa.group}</span>
        <h2>{visa.heading}</h2><div className="subclass-underline" aria-hidden="true" />
        <div className="subclass-hero-row"><div>
          <div className="subclass-tags">{visa.subclasses.map(number => <span key={number}>Subclass {number}</span>)}</div>
          <p className="subclass-lead"><Copy text={visa.intro[0]} contact={contact} /></p>
          <div className="subclass-actions"><Button href={contact} text="Request a free consultation" /><a className="subclass-outline" href={visa.officialUrl}>Official visa requirements ↗</a></div>
        </div><figure className="subclass-image"><Image {...photo} alt={photo.alt} sizes="(max-width: 767px) 100vw, 600px" /><figcaption>{visa.shortName} guidance from Migration Factor</figcaption></figure></div>
        {visa.intro.slice(1).map((text, i) => <p key={i}><Copy text={text} contact={contact} /></p>)}
      </header>
      <details className="subclass-contents"><summary>Explore this guide</summary><nav aria-label="Visa guide sections">{visa.sections.map((section, i) => <a key={i} href={`#${section.id ?? `section-${i}`}`}>{section.heading}<span aria-hidden="true">↗</span></a>)}</nav></details>
      {visa.sections.map((section, i) => <section key={section.id ?? i} className={`subclass-content-section${/Costs|Charges|Processing|Recent|Changes|Deadline/.test(section.heading) ? ' subclass-highlight-section' : ''}`} aria-labelledby={section.id ?? `section-${i}`}>
        <span className="subclass-label">{String(i + 1).padStart(2, '0')} / {section.heading === 'Frequently Asked Questions' ? 'Common questions' : 'Visa guide'}</span>
        <h3 id={section.id ?? `section-${i}`}>{section.heading}</h3><div className="subclass-underline" aria-hidden="true" />
        <SectionBody section={section} contact={contact} />
        {section.links?.map(link => <a className="subclass-source" key={link.href} href={link.href}>{link.label} ↗</a>)}
      </section>)}
      <section className="subclass-tools" aria-labelledby="visa-tools-title"><span className="subclass-label">Helpful tools</span><h3 id="visa-tools-title">Explore your next step</h3><div className="subclass-info-grid">{tools.map(tool => <Link className="subclass-tool-card" href={tool.href} key={tool.href}><Icon type={tool.icon} /><h4>{tool.title}</h4><p>{tool.description}</p><span>Open tool ↗</span></Link>)}</div></section>
      <section className="subclass-cta"><h3>Discuss your {visa.shortName.toLowerCase()} options</h3><p>Request a free consultation with Migration Factor to discuss your circumstances and the information you need to prepare.</p><Button href={contact} text="Request a consultation" /></section>
      <nav className="subclass-related" aria-label="Related visa services"><h3>Explore related visa pathways</h3><div>{visa.parentSlug !== visa.slug && <Link href={`/services/${visa.parentSlug}`}>Explore {visa.group.toLowerCase()} services ↗</Link>}{related.map(item => <Link href={`/services/${item.slug}`} key={item.slug}>{item.name} ↗</Link>)}<Link href="/services">All visa and immigration services ↗</Link></div></nav>
      <p className="subclass-disclaimer">{visa.sourceNote} <a href={visa.officialUrl}>Read the official Home Affairs guidance.</a></p>
    </article></section>
    <CtaSection />
  </>;
}
