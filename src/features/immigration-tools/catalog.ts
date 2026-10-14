export const tools = [
  { slug: 'pr-calculator', name: 'PR Points Calculator', description: 'Estimate your skilled migration points for subclasses 189, 190 and 491, with a category-by-category breakdown.' },
  { slug: 'visa-quiz', name: 'Visa Pathway Quiz', description: 'Explore potential study, skilled, employer-sponsored, partner and visitor pathways based on your circumstances.' },
  { slug: 'eligibility-checker', name: 'General Eligibility Checker', description: 'Review preliminary migration criteria and identify evidence or requirements that need further checking.' },
  { slug: 'subclass-482-checker', name: 'Subclass 482 Eligibility Checker', description: 'Check preliminary Skills in Demand criteria for Core Skills, Specialist Skills and Labour Agreement streams.' },
  { slug: 'business-sponsor-checker', name: 'Employer Sponsorship Checker', description: 'Review business and nomination readiness for subclasses 482, 186 and 494.' },
  { slug: 'sponsorship-cost-estimator', name: 'Sponsorship Cost Estimator', description: 'Estimate sponsorship, nomination and Skilling Australians Fund charges, separate from applicant costs.' },
  { slug: 'applicant-cost-calculator', name: 'Applicant Visa Cost Estimator', description: 'Estimate first-instalment visa charges for a main applicant and accompanying family under subclasses 482, 186 and 494.' },
] as const;
export type ToolSlug = typeof tools[number]['slug'];
export const allTools = [...tools, { slug: 'occupation-search', name: 'CSOL Occupation Search', description: 'Search official Core Skills occupation titles and ANZSCO codes, with stream-specific caveats and 186 assessing authorities.' }] as const;
export const verifiedOn = '2026-10-10';
export const rulesEffectiveUntil = '2027-06-30';
export const disclaimer = 'Preliminary guidance only, not a formal migration assessment. Results do not guarantee eligibility, an invitation or visa approval. Evidence, exemptions and your full circumstances must be checked. Answers stay in this page unless you choose to send your result to our team.';
const immi = 'https://immi.homeaffairs.gov.au';
export const sources = {
  points: `${immi}/supporting/Pages/Work/189-points-table.aspx`,
  nominated: `${immi}/supporting/Pages/Work/190-points-table.aspx`,
  regional: `${immi}/supporting/Pages/Work/491-points-table.aspx`,
  occupations: `${immi}/visas/working-in-australia/skill-occupation-list`,
  english: `${immi}/help-support/meeting-our-requirements/english-language`,
  salary: `${immi}/visas/employing-and-sponsoring-someone/sponsoring-workers/nominating-a-position/salary-requirements`,
  sid: `${immi}/visas/getting-a-visa/visa-listing/skills-in-demand-visa-subclass-482`,
  ens: `${immi}/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186`,
  sesr: `${immi}/visas/getting-a-visa/visa-listing/skilled-employer-sponsored-regional-494`,
  sponsor: `${immi}/visas/employing-and-sponsoring-someone/sponsoring-workers/learn-about-sponsoring/cost-of-sponsoring`,
  fees: 'https://www.legislation.gov.au/F2026L00874/asmade/text',
  levy: 'https://www.legislation.gov.au/F2018L01092/latest/text',
  estimator: `${immi}/visas/visa-pricing-estimator`,
  explorer: `${immi}/visas/getting-a-visa/visa-finder`,
  closed: `${immi}/visas/getting-a-visa/biip-closure-and-refunds`,
  character: `${immi}/help-support/meeting-our-requirements/character`,
  health: `${immi}/help-support/meeting-our-requirements/health`,
};
export const toolSources: Record<ToolSlug, [string, string][]> = {
  'pr-calculator': [['189 points table', sources.points], ['190 nomination points', sources.nominated], ['491 nomination or sponsorship points', sources.regional], ['English evidence and current test requirements', sources.english]],
  'visa-quiz': [['Home Affairs visa finder', sources.explorer], ['Skilled occupation list', sources.occupations], ['Business programme closure', sources.closed]],
  'eligibility-checker': [['Home Affairs visa finder', sources.explorer], ['Character requirements', sources.character], ['Health requirements', sources.health], ['Skilled occupations', sources.occupations]],
  'subclass-482-checker': [['Skills in Demand visa and streams', sources.sid], ['Salary requirements — 2026–27', sources.salary], ['Eligible occupations', sources.occupations], ['English evidence', sources.english]],
  'business-sponsor-checker': [['482 sponsorship', sources.sid], ['Employer Nomination Scheme', sources.ens], ['Regional employer sponsorship', sources.sesr], ['Salary requirements', sources.salary]],
  'sponsorship-cost-estimator': [['Home Affairs sponsorship charges', sources.sponsor], ['SAF levy regulations', sources.levy], ['Visa Pricing Estimator', sources.estimator]],
  'applicant-cost-calculator': [['2026 fee legislation — Schedule 3, items 7, 62 and 64', sources.fees], ['Home Affairs Visa Pricing Estimator', sources.estimator]],
};
