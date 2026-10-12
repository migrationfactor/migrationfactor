import { pageMetadata, pageSchema } from '@/lib/seo';
import JsonLd from '@/components/shared/JsonLd';
import Breadcrumb from '@/components/layout/Breadcrumb';
import AboutSection from '@/components/sections/AboutSection';
import ProcessSection from '@/components/sections/ProcessSection';
import CtaSection from '@/components/sections/CtaSection';
import SectionHeading from '@/components/ui/SectionHeading';
import { company } from '@/content/company';
import { about } from '@/content/about';

export const metadata = pageMetadata("/about", about.title, about.seoDescription);

export default function AboutPage() {
  return (
    <>
      <JsonLd data={pageSchema("/about", about.title, about.seoDescription, 'WebPage')} />
      <Breadcrumb
        name={about.title}
        desc={about.breadcrumbDescription}
      />
      <AboutSection />
      <section className="section soft">
        <div className="container values-grid">
          <article>
            <SectionHeading
              label={about.mission.label}
              heading={about.mission.heading}
              center={false}
            />
            <p>{company.mission}</p>
          </article>
          <article>
            <SectionHeading
              label={about.vision.label}
              heading={
                <>
                  {about.vision.headingLines[0]} <br />
                  {about.vision.headingLines[1]}
                </>
              }
              center={false}
            />
            <p>{company.vision}</p>
          </article>
        </div>
        <div className="container origin-note">
          {about.originNote}
        </div>
      </section>
      <ProcessSection />
      <CtaSection />
    </>
  );
}
