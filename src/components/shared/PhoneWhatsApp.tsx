import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { company } from '@/content/company';

/** The business number as a call link, with a WhatsApp chat link beside it. */
export default function PhoneWhatsApp({ className = '' }: { className?: string }) {
  return (
    <span className={`phone-whatsapp ${className}`.trim()}>
      <a href={`tel:${company.tel}`}>{company.phone}</a>
      <a className="whatsapp-link" href={company.whatsapp} target="_blank" rel="noopener noreferrer"
        aria-label={`Chat on WhatsApp at ${company.phone} (opens in a new tab)`} title="Chat on WhatsApp">
        <WhatsAppIcon />
      </a>
    </span>
  );
}
