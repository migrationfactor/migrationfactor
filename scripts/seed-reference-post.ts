import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { query, queryOne, withTransaction } from '../src/lib/seo-system/db';
import { ensureDefaultAccounts } from '../src/lib/seo-system/auth';
import { createCategory, createAuthor } from '../src/lib/seo-system/taxonomies-service';
import { createDraft, publishPost, updatePost } from '../src/lib/seo-system/posts-service';
import fs from 'fs/promises';
import path from 'path';

async function seedReferencePost() {
  console.log('Seeding Reference Post per SRS Section 1.6, 10.4, 13.3 & Appendix B...');

  await ensureDefaultAccounts();

  // 1. Ensure user
  const adminUser = await queryOne<any>(`SELECT id FROM public.seo_users WHERE email = 'seo@migrationfactor.com'`);
  if (!adminUser) throw new Error('Seo user not found in DB');
  const actorId = adminUser.id;

  // 2. Category: Australia Visas
  let category = await queryOne<any>(`SELECT * FROM public.seo_categories WHERE slug = 'australia-visas'`);
  if (!category) {
    category = await createCategory(actorId, {
      name: 'Australia Visas',
      slug: 'australia-visas',
      description: 'Comprehensive guides, pathways, and requirements for Australian visas.',
      seoTitle: 'Australia Visa Pathways & Requirements | Migration Factor',
      metaDescription: 'Explore skilled migration, employer nomination, partner visas and pathway requirements in Australia.',
      robotsIndex: true,
      robotsFollow: true,
    });
    console.log('Created category: Australia Visas');
  }

  // 3. Author: Ayesha Khan
  let author = await queryOne<any>(`SELECT * FROM public.seo_authors WHERE slug = 'ayesha-khan'`);
  if (!author) {
    author = await createAuthor(actorId, {
      displayName: 'Ayesha Khan',
      slug: 'ayesha-khan',
      jobTitle: 'Registered Migration Agent',
      shortBio: 'Ayesha Khan is a registered migration agent with over 10 years of experience in Australian skilled migration and employer sponsorship pathways.',
      longBio: 'Ayesha Khan specializes in employer-sponsored temporary and permanent residency visas under the Australian migration system. She advises employers and international professionals on nomination criteria and skills assessments.',
      sameAs: [
        'https://www.linkedin.com/in/ayesha-khan-example',
      ],
      credentials: [
        {
          name: 'Registered Migration Agent (OMARA)',
          issuingBody: 'Office of the Migration Agents Registration Authority',
          year: 2016,
        },
      ],
      isExpertReviewer: true,
    });
    console.log('Created author: Ayesha Khan');
  }

  // 4. Featured Image: Ensure file exists in public/uploads/blog/2026/11/
  const imgDir = path.join(process.cwd(), 'public', 'uploads', 'blog', '2026', '11');
  await fs.mkdir(imgDir, { recursive: true });
  const imgPath = path.join(imgDir, 'skills-in-demand-visa-australia-1600x900.jpg');
  try {
    await fs.access(imgPath);
  } catch {
    // Create a 1x1 or sample buffer if not exists
    const dummyBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
      0xff, 0xd9,
    ]);
    await fs.writeFile(imgPath, dummyBuffer);
  }

  const mediaUrl = '/uploads/blog/2026/11/skills-in-demand-visa-australia-1600x900.jpg';
  let media = await queryOne<any>(`SELECT * FROM public.seo_media WHERE filename = 'skills-in-demand-visa-australia-1600x900.jpg'`);
  if (!media) {
    media = await queryOne<any>(
      `INSERT INTO public.seo_media (
        filename, storage_key, url, mime_type, file_size, width, height,
        alt_text, title, caption, uploaded_by
      ) VALUES ($1, $2, $3, 'image/jpeg', 124500, 1600, 900, $4, $5, $6, $7)
      RETURNING *`,
      [
        'skills-in-demand-visa-australia-1600x900.jpg',
        'uploads/blog/2026/11/skills-in-demand-visa-australia-1600x900.jpg',
        mediaUrl,
        'Skilled worker reviewing Australian visa sponsorship documents with an employer',
        'Skills in Demand Visa Australia',
        'Skilled worker reviewing Australian visa sponsorship documents with an employer',
        actorId,
      ]
    );
    console.log('Created featured media record');
  }

  // 5. Reference post content blocks
  const blocks = [
    {
      type: 'paragraph',
      data: {
        text: 'The <strong>Skills in Demand visa</strong> is Australia\'s primary employer-sponsored visa framework designed to address targeted workforce shortages while providing a clearer pathway to permanent residence.',
      },
    },
    {
      type: 'key_takeaways',
      data: {
        title: 'Key Takeaways',
        items: [
          'Replaces the Temporary Skill Shortage (TSS) Subclass 482 visa with three targeted streams: Specialist Skills, Core Skills, and Essential Skills.',
          'Provides clear, guaranteed pathways to Australian permanent residency for eligible workers.',
          'Employers must be approved standard business sponsors and meet market salary rate obligations.',
        ],
      },
    },
    {
      type: 'toc',
      data: {},
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'What Is the Skills in Demand Visa?',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Australia introduced the Skills in Demand visa to simplify employer-sponsored migration. The visa is structured into three specific pathways based on earnings and occupation thresholds, enabling employers to hire international talent when local workers are unavailable.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'Skills in Demand Visa Requirements',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'To qualify for the Skills in Demand visa, candidates must satisfy criteria across occupation eligibility, relevant work experience, health, character, and English language proficiency.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 3,
        text: 'Occupation and Skills Requirements',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Applicants must possess qualifications and formal skills assessment in an occupation identified on the relevant skilled occupation list, demonstrating the necessary expertise to perform the nominated role in Australia.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 3,
        text: 'Work Experience Requirements',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Most streams require at least one to two years of full-time, relevant work experience in the nominated occupation or a closely related field within the past five years.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 3,
        text: 'English Language Requirements',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Applicants must demonstrate competent English language skills through approved examinations such as IELTS, PTE Academic, or equivalent tests, unless an exemption applies.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'Comparison of Visa Streams',
      },
    },
    {
      type: 'table',
      data: {
        caption: 'Skills in Demand Visa Stream Comparison',
        withHeaderRow: true,
        content: [
          ['Stream', 'Salary Threshold', 'Processing Target', 'PR Pathway'],
          ['Specialist Skills', '$135,000+ AUD', 'Fast-tracked (7 days)', 'Direct PR Pathway'],
          ['Core Skills', 'Above TSMIT ($73,150+)', 'Standard (21 days)', 'Employer Nominated PR'],
          ['Essential Skills', 'Under TSMIT (Sector specific)', 'Standard', 'Supported Pathway'],
        ],
      },
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'Employer Sponsorship for the Skills in Demand Visa',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Employers wishing to sponsor an overseas professional must hold approved sponsor status with the Department of Home Affairs, demonstrate genuine labor market testing, and pay the annual market salary rate.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 3,
        text: 'Who Can Sponsor a Worker?',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'Any legally operating Australian business or recognized overseas business can apply to become an approved standard business sponsor, subject to meeting compliance obligations and workplace relations standards.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 3,
        text: 'Nomination Steps for Employers',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'The employer nomination requires lodging job details, salary proof, labor market testing evidence, and payment of the Skilling Australians Fund (SAF) levy.',
      },
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'Frequently Asked Questions',
      },
    },
    {
      type: 'faq',
      data: {
        items: [
          {
            question: 'Who can sponsor a Skills in Demand visa applicant?',
            answer: 'An approved employer sponsor that nominates the position in an eligible occupation and meets salary threshold requirements.',
          },
          {
            question: 'Does the Skills in Demand visa lead to permanent residency?',
            answer: 'Yes, the Skills in Demand visa provides a guaranteed pathway to Australian permanent residency through employer-sponsored permanent visa pathways after meeting qualifying employment periods.',
          },
          {
            question: 'What is the processing time for the Specialist Skills stream?',
            answer: 'Applications under the Specialist Skills stream targeting high-income earners are prioritized with target processing times as fast as 7 days.',
          },
        ],
      },
    },
    {
      type: 'heading',
      data: {
        level: 2,
        text: 'Conclusion: Is the Skills in Demand Visa Right for You?',
      },
    },
    {
      type: 'paragraph',
      data: {
        text: 'The Skills in Demand visa offers a transparent, employer-driven pathway to working and living permanently in Australia. Consulting a registered migration agent ensures your nomination and application adhere to current Department of Home Affairs regulations.',
      },
    },
  ];

  // 6. Check if post already exists
  let post = await queryOne<any>(`SELECT id FROM public.seo_posts WHERE slug = 'skills-in-demand-visa-australia'`);
  if (post) {
    console.log('Post already exists, updating with authoritative reference data...');
    await updatePost(post.id, actorId, {
      title: 'Skills in Demand Visa Australia: Complete Guide to Requirements and Process',
      slug: 'skills-in-demand-visa-australia',
      bodyJson: { blocks },
      excerpt: 'Learn about Skills in Demand Visa requirements, eligibility, sponsorship and application steps in Australia.',
      featuredMediaId: media.id,
      primaryCategoryId: category.id,
      authorIds: [author.id],
      focusKeyword: 'skills in demand visa',
      additionalKeywords: ['skills in demand visa requirements', 'subclass 482 visa', 'employer sponsorship australia'],
      seoTitleRaw: 'Skills in Demand Visa Australia: Requirements and Process',
      metaDescriptionRaw: 'Learn about Skills in Demand Visa requirements, eligibility, sponsorship and application steps in Australia.',
      canonicalUrl: 'https://migrationfactor.com/blog/skills-in-demand-visa-australia/',
      robotsIndex: true,
      robotsFollow: true,
      breadcrumbTitle: 'Skills in Demand Visa Australia',
      customH1: 'Skills in Demand Visa Australia: Complete Guide to Requirements and Process',
      sitemapInclude: true,
      isCornerstone: true,
      articleType: 'BlogPosting',
      faqEnabled: true,
      primaryQuestion: 'Who can sponsor a Skills in Demand visa applicant?',
      answerSummary: 'An approved employer sponsor that nominates the position in an eligible occupation.',
      primaryEntity: {
        name: 'Skills in Demand visa',
        sameAs: 'https://immi.homeaffairs.gov.au/',
      },
      references: [
        {
          title: 'Department of Home Affairs - Employer Sponsored Visas',
          url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482',
          publisher: 'Australian Government Department of Home Affairs',
          publishedDate: '2026',
        },
      ],
    });
  } else {
    post = await createDraft(actorId, {
      title: 'Skills in Demand Visa Australia: Complete Guide to Requirements and Process',
      slug: 'skills-in-demand-visa-australia',
      bodyJson: { blocks },
      excerpt: 'Learn about Skills in Demand Visa requirements, eligibility, sponsorship and application steps in Australia.',
      featuredMediaId: media.id,
      primaryCategoryId: category.id,
      authorIds: [author.id],
      focusKeyword: 'skills in demand visa',
      additionalKeywords: ['skills in demand visa requirements', 'subclass 482 visa', 'employer sponsorship australia'],
      seoTitleRaw: 'Skills in Demand Visa Australia: Requirements and Process',
      metaDescriptionRaw: 'Learn about Skills in Demand Visa requirements, eligibility, sponsorship and application steps in Australia.',
      canonicalUrl: 'https://migrationfactor.com/blog/skills-in-demand-visa-australia/',
      robotsIndex: true,
      robotsFollow: true,
      breadcrumbTitle: 'Skills in Demand Visa Australia',
      customH1: 'Skills in Demand Visa Australia: Complete Guide to Requirements and Process',
      sitemapInclude: true,
      isCornerstone: true,
      articleType: 'BlogPosting',
      faqEnabled: true,
      primaryQuestion: 'Who can sponsor a Skills in Demand visa applicant?',
      answerSummary: 'An approved employer sponsor that nominates the position in an eligible occupation.',
      primaryEntity: {
        name: 'Skills in Demand visa',
        sameAs: 'https://immi.homeaffairs.gov.au/',
      },
      references: [
        {
          title: 'Department of Home Affairs - Employer Sponsored Visas',
          url: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-skill-shortage-482',
          publisher: 'Australian Government Department of Home Affairs',
          publishedDate: '2026',
        },
      ],
    });
    console.log('Created draft reference post:', post.id);
  }

  // 7. Publish Post Immediately
  await publishPost(post.id, actorId, true);
  console.log('Successfully published Reference Post!');
}

seedReferencePost()
  .then(() => {
    console.log('Seeding completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
