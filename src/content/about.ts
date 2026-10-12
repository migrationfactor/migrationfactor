import { company } from './company';

export const about = {
  title: 'About Migration Factor',
  seoDescription: 'Learn about Migration Factor, a Perth-based migration and visa consultancy supporting students, professionals and families.',
  breadcrumbDescription: 'Personalized, professional and transparent visa support.',
  summary: {
    label: 'ABOUT MIGRATION FACTOR', headingLines: ['Guidance for your', 'next chapter.'],
    checks: ['Personalized visa support', 'Professional and transparent guidance', 'Support from planning to submission'],
    button: 'More about Migration Factor',
  },
  mission: { label: 'OUR MISSION', heading: 'Guidance with purpose.' },
  vision: { label: 'OUR VISION', headingLines: ['New beginnings', 'beyond borders.'] },
  originNote: 'Supporting clients from Pakistan, India, Bangladesh, Sri Lanka and Nepal.',
};

export const missionVisionSlides = [
  { title: about.mission.heading, text: company.mission, label: about.mission.label, photo: 'portraitProOne' },
  { title: about.vision.headingLines.join(' '), text: company.vision, label: about.vision.label, photo: 'portraitProTwo' },
];
