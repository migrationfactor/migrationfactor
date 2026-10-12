export interface Guide {
  slug: string;
  title: string;
  seo: { title: string; description: string };
  card: { title: string; description: string; imageSlot: string };
  sections: { heading: string; paragraphs?: string[]; items?: string[] }[];
  button: string;
}

export const guides: Guide[] = [
  {
    slug: 'preparing-your-profile', title: 'Preparing your profile',
    seo: { title: 'Preparing Your Profile', description: 'Prepare your goals and basic profile before requesting a Migration Factor eligibility assessment.' },
    card: { title: 'Getting started', description: 'Clarify your goals and prepare your basic profile.', imageSlot: 'preparation' },
    sections: [
      { heading: 'Start with your objective', paragraphs: ['Clarify whether your objective is study, work, partner, parent, visitor, business or protection.'] },
      { heading: 'Prepare your basic profile', items: ['Passport and age', 'Education and work history', 'English result', 'Family details', 'Current visa status'] },
      { heading: 'Request an eligibility assessment', paragraphs: ['Ask for the pathway, estimated timeline, professional fee and government charges in writing and separately.'] },
    ],
    button: 'Request an eligibility assessment',
  },
  {
    slug: 'document-checklist', title: 'Your document checklist',
    seo: { title: 'Your Document Checklist', description: 'Plan your document checklist and review your application details with Migration Factor.' },
    card: { title: 'Your document checklist', description: 'Discuss documents, fees and application details with the team.', imageSlot: 'documents' },
    sections: [
      { heading: 'Ask for a checklist', paragraphs: ['Obtain a document checklist and confirm validity, translations, certification and evidence requirements.'] },
      { heading: 'Review before lodgement', paragraphs: ['Read and verify all forms, statements, financial evidence and personal details before lodgement.'] },
      { heading: 'Confirm claims and deadlines', paragraphs: ['Cross-check success-rate, guaranteed-approval or fast-outcome claims against official rules and signed engagement terms. If you have received a refusal or cancellation, check the deadline immediately and contact a registered professional without delay.'] },
    ],
    button: 'Discuss your documents',
  },
];
export function getGuide(slug: string) { return guides.find(guide => guide.slug === slug); }
