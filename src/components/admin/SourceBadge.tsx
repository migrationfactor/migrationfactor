export type LeadSource = 'whatsapp' | 'email' | 'contact' | 'booking' | 'tool';

export const sourceLabels: Record<LeadSource, string> = {
  whatsapp: 'From WhatsApp',
  email: 'From email',
  contact: 'From contact form',
  booking: 'From booking',
  tool: 'From visa tool',
};

/** Shows where a lead came from, so every list says WhatsApp, email, contact form or booking. */
export default function SourceBadge({ source }: { source: LeadSource }) {
  return <span className={`admin-source admin-source-${source}`}>{sourceLabels[source]}</span>;
}
