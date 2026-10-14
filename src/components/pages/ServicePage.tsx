import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ProcessSection from '@/components/sections/ProcessSection';
import CtaSection from '@/components/sections/CtaSection';
import JsonLd from '@/components/shared/JsonLd';
import PageContents from '@/components/shared/PageContents';
import Icon from '@/components/ui/Icon';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import Button from '@/components/ui/Button';
import { company } from '@/content/company';
import { visaSubclasses } from '@/content/visa-subclasses/catalog';
import { services, servicePageContent, getServiceImage, getServiceInsetImage, type Service, type ServiceSection } from '@/content/services';
import { pageSchema } from '@/lib/seo';
import { visaPath } from '@/lib/visa-path';

function ServiceText({ text, service }: { text: string; service: string }) {
  return text.split('{{consultation}}').map((part, index) => <Fragment key={index}>{index > 0 && <Link href={`/contact/?service=${encodeURIComponent(service)}`}>request a free consultation</Link>}{part}</Fragment>);
}

function ServiceFaq({ section, service }: { section: ServiceSection; service: string }) {
  const blocks = section.blocks ?? [];
  return <div className="service-faqs">{blocks.map((block, index) => {
    if (block.type !== 'heading') return null;
    const answers = blocks.slice(index + 1, blocks.findIndex((next, nextIndex) => nextIndex > index && next.type === 'heading') === -1 ? blocks.length : blocks.findIndex((next, nextIndex) => nextIndex > index && next.type === 'heading'));
    return <details key={index}><summary><h4>{block.text}</h4><span aria-hidden="true">+</span></summary><div>{answers.map((answer, j) => answer.type === 'paragraph' ? <p key={j}><ServiceText text={answer.text} service={service} /></p> : null)}</div></details>;
  })}</div>;
}

/** The approved shared design for all /services/[slug] pages. */
export default function ServicePage({ service }: { service: Service }) {
  const intro = service.intro?.length ? service.intro : [service.description];
  const sections: ServiceSection[] = service.sections ?? servicePageContent.sections;
  const longPage = sections.length > 5;
  return <>
    <JsonLd data={pageSchema(`/services/${service.slug}`, service.name, service.description, 'Service')} />
    <Breadcrumb name={service.name} desc={service.group} />
    <section className={`section visa-detail${longPage ? ' visa-detail-long' : ''}`}>
      <div className="container detail-layout">
        <article className="visa-detail-article">
          <Image className="visa-detail-photo" {...getServiceImage(service)} alt={getServiceImage(service).alt} sizes="(max-width: 900px) 100vw, 800px" />
          <h2>{service.heading ?? `${service.name} support`}</h2>
          {visaSubclasses.some(visa => visa.parentSlug === service.slug && visa.slug !== service.slug) && <nav className="service-subclass-links" aria-label={`${service.name} subclass pages`}>{visaSubclasses.filter(visa => visa.parentSlug === service.slug && visa.slug !== service.slug).map(visa => <Link href={visaPath(visa.slug)} key={visa.slug}>{visa.name} ↗</Link>)}</nav>}
          {intro.map((paragraph, i) => <p key={i} className={i === 0 ? 'lead' : undefined}><ServiceText text={paragraph} service={service.name} /></p>)}
          {longPage && <PageContents sections={sections.flatMap(section => section.id ? [{ id: section.id, heading: section.heading }] : [])} />}
          {sections.map((section, i) => <section className={longPage ? 'service-copy-section' : undefined} key={section.id ?? i}>
            {i === 0 && !longPage && <div className="visa-detail-inset"><Image {...getServiceInsetImage(service)} alt={getServiceInsetImage(service).alt || service.name} sizes="(max-width: 600px) 100vw, 360px" /><div><Icon type={service.icon} /><h3>{service.name}</h3><p>{service.description}</p></div></div>}
            <h3 id={section.id}>{section.heading}</h3>
            {section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {!!section.items?.length && <ul className="checks">{section.items.map((item, index) => <li key={index}>{item}</li>)}</ul>}
            {section.heading === 'Frequently Asked Questions' ? <ServiceFaq section={section} service={service.name} /> : section.blocks?.map((block, index) => block.type === 'list'
              ? block.ordered ? <ol key={index}>{block.items.map((item, j) => <li key={j}><ServiceText text={item} service={service.name} /></li>)}</ol> : <ul className="checks" key={index}>{block.items.map((item, j) => <li key={j}><ServiceText text={item} service={service.name} /></li>)}</ul>
              : block.type === 'heading' ? <h4 key={index}>{block.text}</h4> : <p key={index}><ServiceText text={block.text} service={service.name} /></p>)}
            {section.links?.map(link => <p key={link.href}><a className="text-link" href={link.href}>{link.label} ↗</a></p>)}
          </section>)}
          <p className="source-note">{service.sourceNote ?? servicePageContent.sourceNote}</p>
          <Button text={servicePageContent.button} href={`/contact/?service=${encodeURIComponent(service.name)}`} />
        </article>
        <aside className="service-sidebar">
          <div className="visa-service-menu">
          <h3>{servicePageContent.sidebarHeading}</h3>
          {services.map(item => <Link key={item.slug} href={`/services/${item.slug}/`} aria-current={item.slug === service.slug ? 'page' : undefined}>{item.name}<span aria-hidden="true">↗</span></Link>)}
          </div>
          <div className="visa-sidebar-cta"><span className="eyebrow">Plan your next step</span><h3>Your future starts with the right destination.</h3><Button text="Discuss this service" href={`/contact/?service=${encodeURIComponent(service.name)}`} /></div>
          <div className="visa-sidebar-guides"><h3>Useful resources</h3><Link href="/guides/document-checklist/">Document checklist <span aria-hidden="true">↗</span></Link><Link href="/guides/preparing-your-profile/">Preparing your profile <span aria-hidden="true">↗</span></Link></div>
          <a className="sidebar-phone" href={`tel:${company.tel}`}><Icon type="phone" />{company.phone}</a>
          <a className="sidebar-phone sidebar-whatsapp" href={company.whatsapp} target="_blank" rel="noopener noreferrer"><WhatsAppIcon />Chat on WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
        </aside>
      </div>
    </section>
    <ProcessSection />
    {service.slug === 'parent-visa' && <CtaSection />}
  </>;
}
