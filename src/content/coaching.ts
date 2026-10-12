import type { IconType } from '@/components/ui/Icon';

// Existing Migration Factor content; edit copy here without changing page components.
export interface CoachingProgram {
  slug: string;
  name: string;
  icon: IconType;
  text: string;
  items: string[];
}

export const coaching: CoachingProgram[] = [
  {
    slug: 'ielts',
    name: 'IELTS Coaching',
    icon: 'study',
    text: 'Listening, Reading, Writing and Speaking, with mock tests, personalized strategies and tutor feedback.',
    items: [
      'Listening and Reading',
      'Writing and Speaking',
      'Mock tests and tutor feedback',
      'Online classes and resource material',
    ],
  },
  {
    slug: 'pte',
    name: 'PTE Coaching',
    icon: 'screen',
    text: 'Computer-based exam patterns, smart techniques, time management and practice materials.',
    items: [
      'Computer-based exam patterns',
      'Smart techniques and time management',
      'Practice materials',
      'Online classes and tutor-led sessions',
    ],
  },
];

export type CoachingCard = [string, 'ielts' | 'pte', 'coachingIELTS' | 'coachingPTE' | 'document' | 'people' | 'check' | 'clock' | 'folder' | 'screen'];
export const coachingCardGroups: CoachingCard[][] = [
  [[coaching[0].name, 'ielts', 'coachingIELTS'], ['Listening & Reading', 'ielts', 'document'],
    ['Writing & Speaking', 'ielts', 'people'], ['Mock Tests & Tutor Feedback', 'ielts', 'check']],
  [[coaching[1].name, 'pte', 'coachingPTE'], ['Smart Techniques & Time Management', 'pte', 'clock'],
    ['Practice Materials', 'pte', 'folder'], ['Online Classes & Tutor-led Sessions', 'pte', 'screen']],
];
