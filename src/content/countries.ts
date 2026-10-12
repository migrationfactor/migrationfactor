// Existing Migration Factor content; edit copy here without changing page components.
export interface Country {
  name: string;
  code: string;
  text: string;
  detail: string;
  href: string;
}

export const countries: Country[] = [
  {
    name: 'Australia',
    code: 'AU',
    text: 'Explore education, employment, permanent residence and family-reunification pathways with Migration Factor.',
    detail: 'View our services',
    href: '/services/',
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    text: 'The company report mentions opportunities related to United Kingdom. Contact the team to confirm the support available for your circumstances.',
    detail: 'Discuss your destination',
    href: '/contact/',
  },
  {
    name: 'Canada',
    code: 'CA',
    text: 'The company report mentions opportunities related to Canada. Contact the team to confirm the support available for your circumstances.',
    detail: 'Discuss your destination',
    href: '/contact/',
  },
  {
    name: 'United States',
    code: 'US',
    text: 'The company report mentions opportunities related to United States. Contact the team to confirm the support available for your circumstances.',
    detail: 'Discuss your destination',
    href: '/contact/',
  },
  {
    name: 'New Zealand',
    code: 'NZ',
    text: 'The company report mentions opportunities related to New Zealand. Contact the team to confirm the support available for your circumstances.',
    detail: 'Discuss your destination',
    href: '/contact/',
  },
  {
    name: 'Europe',
    code: 'EU',
    text: 'The report mentions student support for selected European destinations. Contact the team to discuss the destination you have in mind.',
    detail: 'Discuss your destination',
    href: '/contact/',
  },
];
