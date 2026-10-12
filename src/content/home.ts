import { getService } from './services';

// Existing Migration Factor content; edit copy here without changing page components.
export const home = {
  hero: {
    headingLines: ['Your Future Starts with', 'the Right Destination.'],
    description: 'Personalized guidance for studying, working and living in Australia.',
    supportingText: 'Supporting students, professionals and families.',
    button: 'Start your 2-minute Visa Assessment',
    buttonHref: '#visa-assessment',
  },
  process: { label: 'OUR WORKING PROCESS', headingLines: ['Your journey, one clear', 'step at a time.'] },
  cta: { label: 'PLAN YOUR NEXT STEP', headingLines: ['Your future starts with', 'the right destination.'], button: 'Request an eligibility assessment' },
};
export const steps: [string, string][] = [
  ['Eligibility Check', 'The team reviews your goals, background and visa preferences.'],
  ['Pathway Planning', 'A potential visa strategy is developed around your skills, experience and future ambitions.'],
  ['Document Support', 'Get assistance organizing documents and meeting immigration standards.'],
  ['Smart Submission', 'Your application is reviewed before submission to reduce common errors and improve presentation.'],
];

export const features = [
  {
    service: getService('student-visa')!,
    icon: 'featureStudy',
    title: 'Study overseas',
    desc: 'University selection, financial documents and visa preparation for your education journey.',
  },
  {
    service: getService('skilled-visa')!,
    icon: 'featureAppointment',
    title: 'Work & skilled migration',
    desc: 'Support with expressions of interest, points strategy and skills assessments.',
  },
  {
    service: getService('partner-visa')!,
    icon: 'featureResources',
    title: 'Bring family together',
    desc: 'Guidance for partner and parent pathways, with relationship and sponsor documentation.',
  },
];
