import { Fragment } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Button from '@/components/ui/Button';
import JsonLd from '@/components/shared/JsonLd';
import { type Guide } from '@/content/guides';
import { pageSchema } from '@/lib/seo';

export default function GuidePage({ guide }: { guide: Guide }) {
  return <>
    <JsonLd data={pageSchema(`/guides/${guide.slug}`, guide.seo.title, guide.seo.description, 'Article')} />
    <Breadcrumb name={guide.title} desc="Practical next steps" />
    <section className="section"><article className="container narrow prose">
      {guide.sections.map((section, i) => <Fragment key={i}>
        <h2>{section.heading}</h2>
        {section.paragraphs?.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        {section.items && <ul>{section.items.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      </Fragment>)}
      <Button text={guide.button} href="/contact/" />
    </article></section>
  </>;
}
