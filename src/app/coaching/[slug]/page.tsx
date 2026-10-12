import { pageMetadata, pageSchema } from '@/lib/seo';
import JsonLd from '@/components/shared/JsonLd';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/layout/Breadcrumb';
import CoachingSection from '@/components/sections/CoachingSection';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import SiteImage from '@/components/ui/SiteImage';
import { coaching } from '@/content/coaching';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return coaching.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = coaching.find((c) => c.slug === slug);
  if (!item) return {};
  return pageMetadata(`/coaching/${slug}`, item.name, `${item.name} with Migration Factor. ${item.text}`);
}

export default async function CoachingDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const item = coaching.find((c) => c.slug === slug);

  if (!item) {
    notFound();
  }

  const shortName = item.name.split(' ')[0];

  return (
    <>
      <JsonLd data={pageSchema(`/coaching/${slug}`, item.name, item.text, 'Service')} />
      <Breadcrumb name={item.name} desc="English language preparation" />
      <section className="section">
        <div className="container detail-layout">
          <article>
            <span className="service-icon">
              <Icon type={item.icon} />
            </span>
            <h2>Prepare with {shortName}</h2>
            <p className="lead">{item.text}</p>
            <ul className="checks">
              {item.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>
              Check the official English test requirements of your institution and visa pathway
              before choosing your test.
            </p>
            <Button
              text="Enquire about coaching"
              href={`/contact/?service=${encodeURIComponent(item.name)}`}
            />
          </article>
          <aside className="coaching-aside">
            <SiteImage slot="enquiry" />
            <h3>
              Online classes. <br />
              Personalized preparation.
            </h3>
          </aside>
        </div>
      </section>
      <CoachingSection />
    </>
  );
}
