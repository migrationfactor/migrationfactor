import { pageMetadata, pageSchema } from '@/lib/seo';
import JsonLd from '@/components/shared/JsonLd';
import Breadcrumb from '@/components/layout/Breadcrumb';
import ServiceGrid from '@/components/sections/ServiceGrid';
import ProcessSection from '@/components/sections/ProcessSection';
import CtaSection from '@/components/sections/CtaSection';
import { serviceTraveller } from '@/content/service-destinations';

export const metadata = pageMetadata("/services", "Visa & Immigration Services", "Explore Migration Factor student, visitor, partner, parent, skilled, employer-sponsored, citizenship, business, protection and review services.");

export default function ServicesPage() {
  return (
    <>
      <JsonLd data={pageSchema("/services", "Visa & Immigration Services", "Explore Migration Factor student, visitor, partner, parent, skilled, employer-sponsored, citizenship, business, protection and review services.", 'WebPage')} />
      <Breadcrumb
        name="Visa & immigration services"
        desc="Support for studying, working, living and bringing family together."
      />
      <section className="section visa-listing">
        <div className="container">
          <ServiceGrid />
          <p className="visa-listing-note">Need help choosing your next step? <a href="/contact/">Discuss your circumstances with our team.</a></p>
        </div>
      </section>
      <ProcessSection />
      <CtaSection travellerImage={serviceTraveller} />
    </>
  );
}
