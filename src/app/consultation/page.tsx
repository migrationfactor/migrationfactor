import Breadcrumb from '@/components/layout/Breadcrumb';
import ConsultationForm from '@/components/booking/ConsultationForm';
import JsonLd from '@/components/shared/JsonLd';
import { pageMetadata, pageSchema } from '@/lib/seo';
import '@/styles/features.css';

const title = 'Free Migration Consultation';
const description = 'Plan a free 30-minute phone or video consultation with Migration Factor. Monday to Friday, 9am–9pm Pakistan time. Send a booking request and our team will confirm.';
export const metadata = pageMetadata('/consultation', title, description);
export default function ConsultationPage() {
  return <><JsonLd data={pageSchema('/consultation', title, description)} /><Breadcrumb name={title} desc="A conversation about your next step." /><section className="section"><div className="container"><ConsultationForm /></div></section></>;
}
