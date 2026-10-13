import { Fragment } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb';
import CtaSection from '@/components/sections/CtaSection';
import JsonLd from '@/components/shared/JsonLd';
import Icon from '@/components/ui/Icon';
import { getServiceImage, type ServiceBlock, type ServiceSection } from '@/content/services';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import type { VisaArticle } from '@/content/visa-subclasses/types';
import { pageSchema } from '@/lib/seo';
import { visaPath } from '@/lib/visa-path';

function Copy({ text, contact }: { text: string; contact: string }) {
  return text.split('{{consultation}}').map((part, i) => <Fragment key={i}>{i > 0 && <Link className="pv-link" href={contact}>request a free consultation</Link>}{part}</Fragment>);
}

function Block({ block, contact }: { block: ServiceBlock; contact: string }) {
  if (block.type === 'heading') return <h4 className="pv-h3">{block.text}</h4>;
  if (block.type === 'paragraph') return <p className="pv-p"><Copy text={block.text} contact={contact} /></p>;
  if (block.type !== 'list') return null;
  if (block.ordered) return <ol className="pv-steps">{block.items.map((text, i) => <li className="pv-step" key={i}><span className="pv-step-num" aria-hidden="true">{i + 1}</span><div className="pv-step-body"><p className="pv-p"><Copy text={text} contact={contact} /></p></div></li>)}</ol>;
  return <ul className="pv-list">{block.items.map((text, i) => <li key={i}><span><Copy text={text} contact={contact} /></span></li>)}</ul>;
}

function Faq({ blocks, contact }: { blocks: ServiceBlock[]; contact: string }) {
  return <div className="pv-faq">{blocks.map((block, i) => {
    if (block.type !== 'heading') return null;
    const next = blocks.findIndex((item, j) => j > i && item.type === 'heading');
    return <div className="pv-faq-item" key={i}><div className="pv-faq-q"><span className="pv-faq-q-icon" aria-hidden="true">Q</span><h4 className="pv-faq-q-text">{block.text}</h4></div><div className="pv-faq-a">{blocks.slice(i + 1, next < 0 ? blocks.length : next).map((answer, j) => <Block key={j} block={answer} contact={contact} />)}</div></div>;
  })}</div>;
}

function SectionBody({ section, contact }: { section: ServiceSection; contact: string }) {
  const blocks = section.blocks ?? [];
  if (/Frequently Asked Questions/i.test(section.heading)) return <Faq blocks={blocks} contact={contact} />;
  const groups: { heading?: string; blocks: ServiceBlock[] }[] = [];
  for (const block of blocks) {
    if (block.type === 'heading') groups.push({ heading: block.text, blocks: [] });
    else {
      if (!groups.length) groups.push({ blocks: [] });
      groups[groups.length - 1].blocks.push(block);
    }
  }
  const streams = /Streams Explained/i.test(section.heading);
  const renderBlock = (block: ServiceBlock, i: number) => {
    if (/Four Visas Compared/i.test(section.heading) && block.type === 'list') return <div className="pv-table-wrap" key={i} tabIndex={0} role="region" aria-label="Visa comparison"><table className="pv-table"><thead><tr><th scope="col">Visa subclass</th><th scope="col">Overview</th></tr></thead><tbody>{block.items.map((text, j) => {
      const split = text.indexOf('. ');
      return <tr key={j}><th scope="row">{split < 0 ? text : text.slice(0, split)}</th><td>{split < 0 ? '' : text.slice(split + 2)}</td></tr>;
    })}</tbody></table></div>;
    return <Block key={i} block={block} contact={contact} />;
  };
  return <>
    {section.paragraphs?.map((text, i) => <p className="pv-p" key={i}><Copy text={text} contact={contact} /></p>)}
    {section.items?.length ? <Block block={{ type: 'list', items: section.items }} contact={contact} /> : null}
    {groups.filter(group => !group.heading).map((group, i) => <Fragment key={i}>{group.blocks.map(renderBlock)}</Fragment>)}
    {groups.some(group => group.heading) && <div className={streams ? 'pv-stream-wrap' : 'pv-two-col'}>{groups.filter(group => group.heading).map((group, i) => <div className={streams ? 'pv-stream-card pv-s-blue' : 'pv-glass'} key={i}><h4 className="pv-h3">{group.heading}</h4>{group.blocks.map(renderBlock)}</div>)}</div>}
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
    <JsonLd data={pageSchema(visaPath(visa.slug), visa.name, visa.description, 'Service')} />
    <Breadcrumb name={visa.name} desc={visa.group} />
    <section className="section visa-guide-section"><div className="container"><article className="pv-wrap">
      <section className="pv-section" aria-label="Visa overview">
        <span className="pv-label">{visa.group}</span>
        <h2 className="pv-h1">{visa.heading}</h2><div className="pv-underline" aria-hidden="true" />
        <div className="pv-hero-row"><div>
          <div>{visa.subclasses.map(number => <span className="pv-tag" key={number}>Subclass {number}</span>)}</div>
          {visa.intro.map((text, i) => <p className="pv-p" key={i}><Copy text={text} contact={contact} /></p>)}
          <div className="pv-cta-group"><Link className="pv-cta-btn" href={contact}>Request a free consultation <span aria-hidden="true">↗</span></Link><a className="pv-cta-btn pv-cta-btn-secondary" href={visa.officialUrl}>Official visa requirements <span aria-hidden="true">↗</span></a></div>
        </div><figure className="pv-img-wrap"><Image {...photo} alt={photo.alt} sizes="(max-width: 720px) 100vw, 600px" /><figcaption className="pv-img-caption">{visa.shortName} guidance from Migration Factor</figcaption></figure></div>
      </section>
      {visa.sections.map((section, i) => <section key={section.id ?? i} className="pv-section" aria-labelledby={section.id ?? `section-${i}`}>
        <span className="pv-label">{section.heading === 'Frequently Asked Questions' ? 'Common questions' : 'Visa guide'}</span>
        <h3 className="pv-h2" id={section.id ?? `section-${i}`}>{section.heading}</h3><div className="pv-underline" aria-hidden="true" />
        <SectionBody section={section} contact={contact} />
        {section.links?.map(link => <p className="pv-p" key={link.href}><a className="pv-link-ext" href={link.href}>{link.label} ↗</a></p>)}
      </section>)}
      <section className="pv-section" aria-labelledby="visa-tools-title"><span className="pv-label">Helpful tools</span><h3 className="pv-h2" id="visa-tools-title">Explore your next step</h3><div className="pv-underline" aria-hidden="true" /><div className={`pv-study-wrap${tools.length === 2 ? ' pv-two-cols' : ''}`}>{tools.map(tool => <Link className="pv-study-card" href={tool.href} key={tool.href}><div className="pv-sc-icon"><Icon type={tool.icon} /></div><h4 className="pv-h3">{tool.title}</h4><p>{tool.description}</p><span className="pv-link">Open tool ↗</span></Link>)}</div></section>
      <section className="pv-cta"><h3 className="pv-h2">Discuss your {visa.shortName.toLowerCase()} options</h3><p className="pv-p">Request a free consultation with Migration Factor to discuss your circumstances and the information you need to prepare.</p><Link className="pv-cta-btn" href={contact}>Request a consultation <span aria-hidden="true">↗</span></Link></section>
      <nav className="pv-related" aria-label="Related visa services"><h3 className="pv-related-title">Explore related visa pathways</h3><div className="pv-related-links">{visa.parentSlug !== visa.slug && <Link className="pv-related-link" href={`/services/${visa.parentSlug}`}>Explore {visa.group.toLowerCase()} services ↗</Link>}{related.map(item => <Link className="pv-related-link" href={visaPath(item.slug)} key={item.slug}>{item.name} ↗</Link>)}<Link className="pv-related-link" href="/services">All visa and immigration services ↗</Link></div></nav>
      <p className="pv-disclaimer">{visa.sourceNote} <a className="pv-link" href={visa.officialUrl}>Read the official Home Affairs guidance.</a></p>
    </article></div></section>
    <CtaSection />
  </>;
}
