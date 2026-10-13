import type { allTools } from '@/features/immigration-tools/catalog';

type PublicToolSlug = typeof allTools[number]['slug'];
interface ToolContent {
  title: string;
  description: string;
  heading: string;
  introHeading: string;
  intro: string;
  howHeading: string;
  steps: string[];
  resultHeading: string;
  result: string;
  related: { label: string; href: string }[];
}

/** Editorial copy stays on the server, separate from calculator rules and client form state. */
export const toolContent: Record<PublicToolSlug, ToolContent> = {
  'pr-calculator': {
    title: 'PR Points Calculator Australia — 189, 190 & 491',
    description: 'Estimate Australian skilled migration points for visas 189, 190 and 491. See your age, English, employment, study and partner points in a clear breakdown.',
    heading: 'Australian PR Points Calculator',
    introHeading: 'Estimate your skilled migration points for 189, 190 and 491',
    intro: 'Use this free calculator to explore how your age, English evidence, skilled employment, qualifications and partner circumstances contribute to a points estimate. Choose your visa subclass to include the relevant nomination or sponsorship options.',
    howHeading: 'How to use the PR points calculator',
    steps: ['Choose subclass 189, 190 or 491 and enter your age.', 'Select the English, employment, qualification and study answers that match your evidence.', 'Complete the partner and nomination questions, then calculate your category breakdown.'],
    resultHeading: 'What your points estimate means',
    result: 'The result shows each points category and your estimated total. It does not assess your occupation, verify documents or predict an invitation. Change any answer to compare scenarios, and confirm the official requirements before relying on your score.',
    related: [{ label: 'Skilled visa services', href: '/services/skilled-visa' }, { label: 'Explore visa pathways', href: '/tools/visa-quiz' }, { label: 'Check preliminary eligibility', href: '/tools/eligibility-checker' }],
  },
  'visa-quiz': {
    title: 'Australian Visa Pathway Quiz',
    description: 'Explore Australian study, skilled, employer-sponsored, partner and visitor visa pathways with a free quiz based on your goals and circumstances.',
    heading: 'Australian Visa Pathway Quiz',
    introHeading: 'Find visa pathways to explore for your circumstances',
    intro: 'Start with your reason for coming to Australia, then answer the relevant questions about your background and plans. This quiz helps you identify possible pathways and the information you may need to check next.',
    howHeading: 'How to use the visa pathway quiz',
    steps: ['Choose your main goal, such as study, work, joining a partner or visiting.', 'Answer the follow-up questions shown for your situation.', 'Review the suggested pathways and missing evidence, then edit your answers if your plans change.'],
    resultHeading: 'Understanding your suggested visa pathways',
    result: 'Suggestions are starting points for further investigation. The quiz cannot review your full visa history or decide which visa you can obtain. Read the relevant service guide and official requirements before choosing a pathway.',
    related: [{ label: 'Explore visa and immigration services', href: '/services' }, { label: 'General eligibility checker', href: '/tools/eligibility-checker' }, { label: 'Prepare your migration profile', href: '/guides/preparing-your-profile' }],
  },
  'eligibility-checker': {
    title: 'Australian Visa Eligibility Checker',
    description: 'Review preliminary Australian migration criteria. Identify potentially relevant pathways, unmet requirements and evidence needing further verification.',
    heading: 'Australian Visa Eligibility Checker',
    introHeading: 'Review your migration readiness before taking the next step',
    intro: 'Use this general checker to organise your circumstances and identify requirements that need attention. It provides a preliminary view of relevant migration criteria rather than a decision about visa eligibility.',
    howHeading: 'How to complete the eligibility check',
    steps: ['Enter your current circumstances and the evidence you have available.', 'Answer the relevant background, skills and migration questions honestly.', 'Review which criteria appear met, need attention or still require verification.'],
    resultHeading: 'What the eligibility checklist can tell you',
    result: 'The result separates your self-reported answers from matters that need further checking. An unknown answer is not an automatic refusal, and an apparently met criterion is not proof of eligibility. Use the checklist to prepare questions and documents for an individual assessment.',
    related: [{ label: 'Australian visa pathway quiz', href: '/tools/visa-quiz' }, { label: 'Skilled migration points calculator', href: '/tools/pr-calculator' }, { label: 'Migration document checklist', href: '/guides/document-checklist' }],
  },
  'subclass-482-checker': {
    title: 'Subclass 482 Skills in Demand Eligibility Checker',
    description: 'Review preliminary subclass 482 Skills in Demand criteria for Core Skills, Specialist Skills and Labour Agreement streams, with evidence to check next.',
    heading: 'Subclass 482 Skills in Demand Eligibility Checker',
    introHeading: 'Check the relevant 482 stream and your supporting evidence',
    intro: 'Review your proposed employer-sponsored pathway by selecting the relevant Skills in Demand stream. The questions cover occupation, experience, sponsorship, English and salary evidence, with separate handling for Labour Agreement conditions.',
    howHeading: 'How to use the subclass 482 checker',
    steps: ['Choose Core Skills, Specialist Skills or the Labour Agreement stream.', 'Answer the sponsorship, occupation, work experience and evidence questions shown.', 'Review the stream-specific checks and confirm any unknown requirements with official sources.'],
    resultHeading: 'Understanding the 482 preliminary result',
    result: 'This checklist cannot confirm that an employer nomination will be approved or that your documents satisfy Home Affairs. Stream conditions and exemptions need individual verification. For employer readiness and occupation research, use the linked tools below.',
    related: [{ label: 'Employer-sponsored visa services', href: '/services/employer-sponsored-visa' }, { label: 'Search Core Skills occupations', href: '/tools/occupation-search' }, { label: 'Employer sponsorship readiness checker', href: '/tools/business-sponsor-checker' }],
  },
  'business-sponsor-checker': {
    title: 'Employer Sponsorship Checker — 482, 186 & 494',
    description: 'Review employer sponsorship and nomination readiness for Australian visas 482, 186 and 494, including business, position, salary and regional considerations.',
    heading: 'Employer Sponsorship Eligibility Checker',
    introHeading: 'Review business readiness to sponsor an overseas worker',
    intro: 'This business-focused checker helps employers organise the information needed to investigate subclasses 482, 186 and 494. Review the proposed position, business circumstances and relevant nomination considerations before seeking a detailed assessment.',
    howHeading: 'How to review employer sponsorship readiness',
    steps: ['Choose the proposed visa pathway and describe the business circumstances.', 'Answer the relevant position, salary, recruitment and regional questions.', 'Review the readiness checklist and identify evidence or conditions still needing verification.'],
    resultHeading: 'What the sponsorship readiness result means',
    result: 'The output highlights apparent gaps and matters to investigate. It does not approve a business as a sponsor or assess an individual worker. Applicant eligibility and employer obligations should be reviewed separately before lodging an application.',
    related: [{ label: 'Employer-sponsored visa services', href: '/services/employer-sponsored-visa' }, { label: 'Estimate sponsorship government charges', href: '/tools/sponsorship-cost-estimator' }, { label: 'Subclass 482 applicant eligibility checker', href: '/tools/subclass-482-checker' }],
  },
  'sponsorship-cost-estimator': {
    title: 'Australian Employer Sponsorship Cost Estimator',
    description: 'Estimate government sponsorship, nomination and SAF levy charges for Australian employer-sponsored visas. Keep employer and applicant costs separate.',
    heading: 'Employer Sponsorship Cost Estimator',
    introHeading: 'Estimate sponsorship, nomination and SAF levy charges',
    intro: 'Use this calculator to plan the government charges associated with an employer-sponsored pathway. It separates sponsorship and nomination costs from applicant visa charges and does not add invented professional fees.',
    howHeading: 'How to estimate employer sponsorship costs',
    steps: ['Choose the visa subclass and relevant business circumstances.', 'Enter nomination duration or turnover details where the calculator asks for them.', 'Calculate the itemised employer estimate, then check applicant charges separately.'],
    resultHeading: 'What is included in the sponsorship estimate?',
    result: 'The breakdown covers the applicable standard government components supported by the calculator. Exemptions, special nomination circumstances, payment surcharges, refunds and professional fees may change the actual cost. Cross-check the current official charges before budgeting or payment.',
    related: [{ label: 'Applicant visa cost estimator', href: '/tools/applicant-cost-calculator' }, { label: 'Check employer sponsorship readiness', href: '/tools/business-sponsor-checker' }, { label: 'Employer-sponsored visa guidance', href: '/services/employer-sponsored-visa' }],
  },
  'applicant-cost-calculator': {
    title: 'Australian Visa Cost Calculator — 482, 186 & 494',
    description: 'Estimate first-instalment Australian visa charges for subclasses 482, 186 and 494. See main applicant, additional adult and child costs separately.',
    heading: 'Australian Visa Application Cost Estimator',
    introHeading: 'Estimate applicant and accompanying family visa charges',
    intro: 'Calculate supported first-instalment government visa charges for subclasses 482, 186 and 494. Enter the accompanying adults and children to see how the family components contribute to your estimate.',
    howHeading: 'How to calculate applicant visa charges',
    steps: ['Choose the supported subclass and applicable fee conditions.', 'Enter the number of additional adults and children joining the application.', 'Review the itemised charges and check the official Visa Pricing Estimator before applying.'],
    resultHeading: 'Understand what your visa cost estimate excludes',
    result: 'This is a first-instalment estimate rather than a complete application budget. Second instalments, special application charges, payment surcharges, health checks, English tests and professional fees are outside the standard total. Any concession eligibility must be verified separately.',
    related: [{ label: 'Employer sponsorship cost estimator', href: '/tools/sponsorship-cost-estimator' }, { label: 'Employer-sponsored visa services', href: '/services/employer-sponsored-visa' }, { label: 'Prepare your document checklist', href: '/guides/document-checklist' }],
  },
  'occupation-search': {
    title: 'CSOL Occupation Search — ANZSCO, 482 & 186',
    description: 'Search Core Skills occupations by title or ANZSCO code. Review 482 Core Skills caveats and 186 Direct Entry assessing authorities in the official snapshot.',
    heading: 'Core Skills Occupation List (CSOL) Search',
    introHeading: 'Search occupations by job title or ANZSCO code',
    intro: 'Find occupation entries in the official snapshots used for 482 Core Skills and 186 Direct Entry. Switch the pathway to review the relevant occupation caveats and, for 186, the listed assessing authority.',
    howHeading: 'How to search the Core Skills occupation list',
    steps: ['Enter an occupation title, a broader keyword or an ANZSCO code.', 'Select 482 Core Skills or 186 Direct Entry to view the relevant details.', 'Read any caveats and verify the current official instrument before relying on a match.'],
    resultHeading: 'What an occupation list match means',
    result: 'A matching title does not confirm that your duties, skills or proposed position meet the occupation definition. This search is not the occupation list for subclasses 189, 190, 491 or 494. It uses a dated official snapshot, so amendments and other visa requirements still need checking.',
    related: [{ label: 'Subclass 482 eligibility checker', href: '/tools/subclass-482-checker' }, { label: 'Employer sponsorship readiness checker', href: '/tools/business-sponsor-checker' }, { label: 'Employer-sponsored visa services', href: '/services/employer-sponsored-visa' }],
  },
};
