import { pageMetadata, pageSchema } from '@/lib/seo';
import JsonLd from '@/components/shared/JsonLd';
import Breadcrumb from '@/components/layout/Breadcrumb';
import SectionHeading from '@/components/ui/SectionHeading';
import Icon from '@/components/ui/Icon';
import EnquiryForm from '@/components/sections/EnquiryForm';
import PhoneWhatsApp from '@/components/shared/PhoneWhatsApp';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { company } from '@/content/company';

export const metadata = pageMetadata("/contact", "Contact Migration Factor", "Contact Migration Factor at +61 0450 635 162 or info@migrationfactor.com. Offices listed in Mirrabooka, Perth and Cranbourne, Melbourne.");

export default function ContactPage() {
  return (
    <>
      <JsonLd data={pageSchema("/contact", "Contact Migration Factor", "Contact Migration Factor at +61 0450 635 162 or info@migrationfactor.com. Offices listed in Mirrabooka, Perth and Cranbourne, Melbourne.", 'WebPage')} />
      <Breadcrumb
        name="Let’s talk about your future"
        desc="Start with your goals. We’ll help you explore your next steps."
      />
      <section className="section">
        <div className="container contact-grid">
          <div>
            <SectionHeading
              label="CONTACT MIGRATION FACTOR"
              heading={
                <>
                  A conversation is <br />
                  your first step.
                </>
              }
              center={false}
            />
            <div className="contact-item">
              <Icon type="phone" />
              <div>
                <h3>Call our team</h3>
                <PhoneWhatsApp />
              </div>
            </div>
            <div className="contact-item">
              <WhatsAppIcon className="icon whatsapp-icon" />
              <div>
                <h3>Chat on WhatsApp</h3>
                <a href={company.whatsapp} target="_blank" rel="noopener noreferrer">Message {company.phone} on WhatsApp<span className="sr-only"> (opens in a new tab)</span></a>
              </div>
            </div>
            <div className="contact-item">
              <Icon type="mail" />
              <div>
                <h3>Email us</h3>
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </div>
            </div>
            {company.offices.map((office, idx) => (
              <div key={office} className="contact-item">
                <Icon type="pin" />
                <div>
                  <h3>{idx === 0 ? 'Perth' : 'Melbourne'} office</h3>
                  <p>{office}</p>
                </div>
              </div>
            ))}
            <p>{company.hours}. Contact the team before visiting.</p>
          </div>
          <EnquiryForm id="contact" entrance="up" />
        </div>
      </section>
    </>
  );
}
