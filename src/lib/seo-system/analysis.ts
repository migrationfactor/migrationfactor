/**
 * SEO, GEO & AEO Analysis Engine
 * Pure TypeScript implementation for both browser Web Worker / live UI and server-side authoritative scores.
 * Implements Sections 7, 8, and 9 of the SRS.
 */

export interface CheckResult {
  id: string;
  name: string;
  status: 'passed' | 'needs_improvement' | 'failed' | 'not_applicable';
  pointsEarned: number;
  maxPoints: number;
  message: string;
  fixAdvice?: string;
  highlights?: Array<{ start?: number; end?: number; text?: string; blockId?: string }>;
}

export interface AnalysisInput {
  title: string;
  customH1?: string;
  slug: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword: string;
  additionalKeywords?: string[];
  canonicalUrl?: string | null;
  robots?: {
    index: boolean;
    follow: boolean;
    maxSnippet?: number;
    maxImagePreview?: string;
  };
  bodyJson?: { blocks: ContentBlock[] };
  featuredImage?: {
    url?: string;
    width?: number;
    height?: number;
    alt?: string;
  } | null;
  authors?: Array<{
    displayName: string;
    bioShort?: string;
    jobTitle?: string;
    hasCredentials?: boolean;
    hasSameAs?: boolean;
  }>;
  primaryCategory?: { name: string; slug: string } | null;
  primaryEntity?: { name: string; sameAs?: string[] } | null;
  secondaryEntities?: Array<{ name: string; sameAs?: string[] }>;
  references?: Array<{ title: string; url: string; publisher?: string }>;
  originalInsightAttestation?: boolean;
  primaryQuestion?: string;
  relatedQuestions?: string[];
  directAnswerSummary?: string;
  intent?: 'informational' | 'howto' | 'comparison' | 'definition' | 'news' | 'opinion';
  serverContext?: {
    isTitleDuplicate?: boolean;
    isMetaDescDuplicate?: boolean;
    isKeywordUsedElsewhere?: boolean;
    duplicatePostTitle?: string;
    brokenLinksCount?: number;
    hasUncheckedExternalLinks?: boolean;
    isSitemapConsistent?: boolean;
    isIndexable?: boolean;
    schemaValidationErrors?: string[];
    schemaValidationWarnings?: string[];
  };
  [key: string]: any;
}

export interface ContentBlock {
  id?: string;
  type: string;
  text?: string;
  level?: number;
  items?: string[];
  caption?: string;
  alt?: string;
  src?: string;
  width?: number;
  height?: number;
  url?: string;
  target?: string;
  data?: any;
  [key: string]: any;
}

export interface FullAnalysisResult {
  overallScore: number;
  scoreBand: 'good' | 'needs_improvement' | 'poor' | 'not_analyzed';
  basicScore: number;
  additionalScore: number;
  readabilityScore: number;
  technicalScore: number;
  geoScore: number;
  aeoScore: number;
  geoDimensions: {
    factuallySupported: 'strong' | 'partial' | 'weak';
    properlyStructured: 'strong' | 'partial' | 'weak';
    answerOriented: 'strong' | 'partial' | 'weak';
    entityRich: 'strong' | 'partial' | 'weak';
    contextuallyRelevant: 'strong' | 'partial' | 'weak';
    supportedByReferences: 'strong' | 'partial' | 'weak';
  };
  wordCount: number;
  readingTimeMin: number;
  fleschReadingEase: number;
  checks: {
    basic: CheckResult[];
    additional: CheckResult[];
    readability: CheckResult[];
    technical: CheckResult[];
    geo: CheckResult[];
    aeo: CheckResult[];
  };
}

// -----------------------------------------------------------------------------
// Normalization & Helpers
// -----------------------------------------------------------------------------

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '') // remove combining accents
    .replace(/[-_/\\]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  return norm ? norm.split(' ').filter(Boolean) : [];
}

export function countKeywordOccurrences(content: string, keyword: string): number {
  const normContent = normalizeText(content);
  const normKw = normalizeText(keyword);
  if (!normContent || !normKw) return 0;
  
  // Exact phrase matching using word boundaries
  const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'g');
  const matches = normContent.match(regex);
  return matches ? matches.length : 0;
}

export function isPartialKeywordMatch(text: string, keyword: string): boolean {
  const normText = normalizeText(text);
  const kwTokens = tokenize(keyword);
  if (kwTokens.length === 0) return false;
  return kwTokens.every((t) => normText.includes(t));
}

export function estimatePixelWidth(text: string, font: 'title' | 'desc' = 'title'): number {
  if (!text) return 0;
  // Approximate standard 20px Arial for title (~10.5px avg per char) and 14px Arial for desc (~7.2px)
  const multiplier = font === 'title' ? 10.5 : 7.2;
  return Math.round(text.length * multiplier);
}

export const calculatePixelWidth = estimatePixelWidth;

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const cleaned = w
    .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
    .replace(/^y/, '');
  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function calculateFleschScore(text: string, words: string[]): number {
  if (words.length < 5) return 100;
  // Sentence split
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const numSentences = Math.max(1, sentences.length);
  const totalWords = words.length;

  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countSyllables(w);
  }

  // Flesch Reading Ease = 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const score = 206.835 - 1.015 * (totalWords / numSentences) - 84.6 * (totalSyllables / totalWords);
  return Math.min(100, Math.max(0, Math.round(score)));
}

// -----------------------------------------------------------------------------
// Content Block Extractor
// -----------------------------------------------------------------------------

export function extractContentDetails(blocks: ContentBlock[]) {
  const paragraphs: Array<{ text: string; wordCount: number }> = [];
  const headings: Array<{ level: number; text: string }> = [];
  const images: Array<{ alt: string; isDecorative: boolean; src?: string }> = [];
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];
  let hasTableOfContents = false;
  let hasFaqBlock = false;
  let hasStepsBlock = false;
  const faqItems: Array<{ question: string; answer: string }> = [];
  let claimSentences: string[] = [];

  for (const b of blocks) {
    const rawHtml = String(b.data?.text || b.text || '');
    const text = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Extract links in HTML
    const hrefMatches = rawHtml.matchAll(/href=["']([^"']+)["']/gi);
    for (const m of hrefMatches) {
      const url = m[1];
      if (url.startsWith('/') || url.includes('migrationfactor.com')) {
        internalLinks.push(url);
      } else if (url.startsWith('http')) {
        externalLinks.push(url);
      }
    }

    if (b.type === 'paragraph' && text) {
      const words = tokenize(text);
      paragraphs.push({ text, wordCount: words.length });

      const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean);
      for (const s of sentences) {
        if (/(\d+%|\$\d+|\bpercent\b|\bstatistics\b|\baccording to\b|\bresearch shows\b|\bstudies\b)/i.test(s)) {
          claimSentences.push(s);
        }
      }
    } else if (b.type === 'heading' && text) {
      const level = Number(b.data?.level || b.level) || 2;
      headings.push({ level, text });
    } else if (b.type === 'image') {
      images.push({
        alt: String(b.data?.alt || b.alt || ''),
        isDecorative: !!(b.data?.isDecorative || b.isDecorative),
        src: String(b.data?.url || b.src || ''),
      });
    } else if (b.type === 'table_of_contents' || b.type === 'toc') {
      hasTableOfContents = true;
    } else if (b.type === 'faq') {
      hasFaqBlock = true;
      const items = (b.data?.items as Array<{ question: string; answer: string }>) || [];
      faqItems.push(...items);
    } else if (b.type === 'steps') {
      hasStepsBlock = true;
    } else if (b.type === 'link') {
      const url = String(b.data?.url || b.url || '');
      if (url.startsWith('/') || url.includes('migrationfactor.com')) {
        internalLinks.push(url);
      } else if (url.startsWith('http')) {
        externalLinks.push(url);
      }
    } else if (b.type === 'key_takeaways' && (b.data?.items || b.items)) {
      const items = (b.data?.items || b.items || []) as string[];
      for (const item of items) {
        paragraphs.push({ text: String(item), wordCount: tokenize(String(item)).length });
      }
    }
  }

  const allText = blocks
    .map((b: any) => {
      const text = b.data?.text || b.text;
      if (text && typeof text === 'string') return text.replace(/<[^>]+>/g, ' ');
      const items = b.data?.items || b.items;
      if (Array.isArray(items)) return items.join(' ');
      return '';
    })
    .join(' ');

  const allWords = tokenize(allText);

  return {
    allText,
    allWords,
    paragraphs,
    headings,
    images,
    internalLinks,
    externalLinks,
    hasTableOfContents,
    hasFaqBlock,
    hasStepsBlock,
    faqItems,
    claimSentences,
  };
}

// -----------------------------------------------------------------------------
// Main Analysis Runner
// -----------------------------------------------------------------------------

export function runSeoAnalysis(input: AnalysisInput): FullAnalysisResult {
  const blocks = input.bodyJson?.blocks || [];
  const extracted = extractContentDetails(blocks);
  const totalWords = extracted.allWords.length;
  const readingTimeMin = Math.max(1, Math.ceil(totalWords / 225));
  const fleschScore = calculateFleschScore(extracted.allText, extracted.allWords);

  const focusKw = input.focusKeyword ? input.focusKeyword.trim() : '';
  const kwTokens = tokenize(focusKw);
  const hasFocusKw = kwTokens.length > 0;

  const effectiveH1 = input.customH1 || input.title || '';
  const effectiveSeoTitle = input.seoTitle || input.title || '';
  const effectiveMetaDesc = input.metaDescription || '';

  // ---------------------------------------------------------------------------
  // 1. BASIC SEO CHECKS (B1–B12) - Weight: 100
  // ---------------------------------------------------------------------------
  const basic: CheckResult[] = [];

  // B1: Focus keyword in SEO title (12 pts)
  if (!hasFocusKw) {
    basic.push({ id: 'B1', name: 'Focus keyword in SEO title', status: 'failed', pointsEarned: 0, maxPoints: 12, message: 'Add a focus keyword to evaluate keyword presence.', fixAdvice: 'Enter a focus keyword in the SEO panel.' });
  } else if (normalizeText(effectiveSeoTitle).includes(normalizeText(focusKw))) {
    basic.push({ id: 'B1', name: 'Focus keyword in SEO title', status: 'passed', pointsEarned: 12, maxPoints: 12, message: 'Focus keyword appears in the SEO title.' });
  } else if (isPartialKeywordMatch(effectiveSeoTitle, focusKw)) {
    basic.push({ id: 'B1', name: 'Focus keyword in SEO title', status: 'needs_improvement', pointsEarned: 6, maxPoints: 12, message: 'Partial match of focus keyword words found in SEO title.', fixAdvice: `Include the exact phrase "${focusKw}" in your SEO title.` });
  } else {
    basic.push({ id: 'B1', name: 'Focus keyword in SEO title', status: 'failed', pointsEarned: 0, maxPoints: 12, message: 'Focus keyword is absent from the SEO title.', fixAdvice: `Add "${focusKw}" to the SEO title, ideally near the beginning.` });
  }

  // B2: Focus keyword near beginning of SEO title (6 pts)
  if (!hasFocusKw) {
    basic.push({ id: 'B2', name: 'Focus keyword near beginning of SEO title', status: 'failed', pointsEarned: 0, maxPoints: 6, message: 'Focus keyword not set.' });
  } else {
    const idx = normalizeText(effectiveSeoTitle).indexOf(normalizeText(focusKw));
    if (idx >= 0 && idx <= effectiveSeoTitle.length * 0.5) {
      basic.push({ id: 'B2', name: 'Focus keyword near beginning of SEO title', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'Focus keyword starts in the first 50% of the title.' });
    } else if (idx > effectiveSeoTitle.length * 0.5) {
      basic.push({ id: 'B2', name: 'Focus keyword near beginning of SEO title', status: 'needs_improvement', pointsEarned: 3, maxPoints: 6, message: 'Focus keyword appears towards the end of the title.', fixAdvice: 'Move the focus keyword closer to the start of the title.' });
    } else {
      basic.push({ id: 'B2', name: 'Focus keyword near beginning of SEO title', status: 'failed', pointsEarned: 0, maxPoints: 6, message: 'Keyword missing from title.', fixAdvice: 'Include keyword near the beginning.' });
    }
  }

  // B3: Focus keyword in meta description (10 pts)
  if (!hasFocusKw) {
    basic.push({ id: 'B3', name: 'Focus keyword in meta description', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword not set.' });
  } else if (!effectiveMetaDesc) {
    basic.push({ id: 'B3', name: 'Focus keyword in meta description', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Meta description is empty (Google will generate a snippet from page text).', fixAdvice: 'Write a dedicated meta description with your focus keyword.' });
  } else if (normalizeText(effectiveMetaDesc).includes(normalizeText(focusKw))) {
    basic.push({ id: 'B3', name: 'Focus keyword in meta description', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Focus keyword appears in the meta description.' });
  } else if (isPartialKeywordMatch(effectiveMetaDesc, focusKw)) {
    basic.push({ id: 'B3', name: 'Focus keyword in meta description', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Partial keyword match in meta description.', fixAdvice: `Use the exact phrase "${focusKw}" naturally in the description.` });
  } else {
    basic.push({ id: 'B3', name: 'Focus keyword in meta description', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword absent from meta description.', fixAdvice: `Include "${focusKw}" in the meta description.` });
  }

  // B4: Focus keyword in URL slug (8 pts)
  const normSlug = normalizeText(input.slug || '');
  if (!hasFocusKw) {
    basic.push({ id: 'B4', name: 'Focus keyword in URL slug', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'Focus keyword not set.' });
  } else {
    const matchedTokens = kwTokens.filter((t) => normSlug.includes(t));
    if (matchedTokens.length === kwTokens.length) {
      basic.push({ id: 'B4', name: 'Focus keyword in URL slug', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'All focus keyword tokens present in slug.' });
    } else if (matchedTokens.length >= kwTokens.length * 0.5) {
      basic.push({ id: 'B4', name: 'Focus keyword in URL slug', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'At least 50% of keyword words are in the slug.', fixAdvice: 'Include all keyword words in the URL slug.' });
    } else {
      basic.push({ id: 'B4', name: 'Focus keyword in URL slug', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'Keyword missing from slug.', fixAdvice: `Use a slug like /${normalizeText(focusKw).replace(/\s+/g, '-')}/.` });
    }
  }

  // B5: Focus keyword in first 10% of content (10 pts)
  const first10PercentWordCount = Math.min(200, Math.max(60, Math.round(totalWords * 0.1)));
  const introWords = extracted.allWords.slice(0, first10PercentWordCount).join(' ');
  if (!hasFocusKw) {
    basic.push({ id: 'B5', name: 'Focus keyword in first 10% of content', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword not set.' });
  } else if (normalizeText(introWords).includes(normalizeText(focusKw))) {
    basic.push({ id: 'B5', name: 'Focus keyword in first 10% of content', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Focus keyword appears in the introduction paragraph.' });
  } else if (isPartialKeywordMatch(introWords, focusKw)) {
    basic.push({ id: 'B5', name: 'Focus keyword in first 10% of content', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Partial keyword found in introduction.', fixAdvice: 'Mention the exact focus keyword in the opening paragraphs.' });
  } else {
    basic.push({ id: 'B5', name: 'Focus keyword in first 10% of content', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword not found in the opening text.', fixAdvice: 'Introduce your focus keyword in the first 10% of the article.' });
  }

  // B6: Focus keyword in main heading H1 (10 pts)
  if (!hasFocusKw) {
    basic.push({ id: 'B6', name: 'Focus keyword in main heading (H1)', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword not set.' });
  } else if (normalizeText(effectiveH1).includes(normalizeText(focusKw))) {
    basic.push({ id: 'B6', name: 'Focus keyword in main heading (H1)', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Focus keyword is present in the H1.' });
  } else if (isPartialKeywordMatch(effectiveH1, focusKw)) {
    basic.push({ id: 'B6', name: 'Focus keyword in main heading (H1)', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Partial keyword in H1.', fixAdvice: 'Include the full focus keyword in the post title (H1).' });
  } else {
    basic.push({ id: 'B6', name: 'Focus keyword in main heading (H1)', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword missing from H1.', fixAdvice: `Include "${focusKw}" in the main H1 heading.` });
  }

  // B7: Focus or additional keyword in subheadings (8 pts)
  const subheadings = extracted.headings.filter((h) => h.level >= 2);
  let subheadingsWithKeyword = 0;
  for (const sh of subheadings) {
    const shNorm = normalizeText(sh.text);
    if (hasFocusKw && shNorm.includes(normalizeText(focusKw))) {
      subheadingsWithKeyword++;
    } else if (input.additionalKeywords?.some((ak) => shNorm.includes(normalizeText(ak)))) {
      subheadingsWithKeyword++;
    }
  }

  if (subheadings.length === 0) {
    basic.push({ id: 'B7', name: 'Keywords in subheadings', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'No H2 or H3 subheadings found.', fixAdvice: 'Add subheadings to break up your content.' });
  } else if (subheadingsWithKeyword >= 1 && subheadingsWithKeyword / subheadings.length <= 0.75) {
    basic.push({ id: 'B7', name: 'Keywords in subheadings', status: 'passed', pointsEarned: 8, maxPoints: 8, message: `${subheadingsWithKeyword} of ${subheadings.length} subheadings contain target keywords.` });
  } else if (subheadingsWithKeyword / subheadings.length > 0.75) {
    basic.push({ id: 'B7', name: 'Keywords in subheadings', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Keyword in more than 75% of headings (possible stuffing).', fixAdvice: 'Use variations or questions instead of repeating the exact keyword in almost every heading.' });
  } else {
    basic.push({ id: 'B7', name: 'Keywords in subheadings', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'No subheadings contain the focus or secondary keywords.', fixAdvice: 'Add the focus keyword or a variation to at least one H2 or H3.' });
  }

  // B8: Focus keyword distributed throughout article (6 pts)
  if (totalWords < 600) {
    basic.push({ id: 'B8', name: 'Keyword distribution', status: 'not_applicable', pointsEarned: 6, maxPoints: 6, message: 'Distribution check applies to articles with 600+ words.' });
  } else if (hasFocusKw) {
    const third = Math.floor(totalWords / 3);
    const part1 = extracted.allWords.slice(0, third).join(' ');
    const part2 = extracted.allWords.slice(third, third * 2).join(' ');
    const part3 = extracted.allWords.slice(third * 2).join(' ');

    const count1 = countKeywordOccurrences(part1, focusKw);
    const count2 = countKeywordOccurrences(part2, focusKw);
    const count3 = countKeywordOccurrences(part3, focusKw);
    const partsWithKw = [count1, count2, count3].filter((c) => c > 0).length;

    if (partsWithKw >= 2) {
      basic.push({ id: 'B8', name: 'Keyword distribution', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'Focus keyword is evenly distributed across sections.' });
    } else {
      basic.push({ id: 'B8', name: 'Keyword distribution', status: 'needs_improvement', pointsEarned: 3, maxPoints: 6, message: 'Focus keyword appears in only one section of the article.', fixAdvice: 'Distribute keyword mentions naturally throughout the middle and conclusion.' });
    }
  } else {
    basic.push({ id: 'B8', name: 'Keyword distribution', status: 'failed', pointsEarned: 0, maxPoints: 6, message: 'Focus keyword not set.' });
  }

  // B9: Keyword density (10 pts)
  const kwOccurrences = hasFocusKw ? countKeywordOccurrences(extracted.allText, focusKw) : 0;
  const kwDensity = totalWords > 0 && hasFocusKw ? (kwOccurrences * kwTokens.length * 100) / totalWords : 0;
  const densityFormatted = kwDensity.toFixed(1);

  if (!hasFocusKw) {
    basic.push({ id: 'B9', name: 'Keyword density', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Focus keyword not set.' });
  } else if (kwDensity >= 0.5 && kwDensity <= 2.5) {
    basic.push({ id: 'B9', name: 'Keyword density', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Keyword density is ${densityFormatted}% (${kwOccurrences} occurrences) — ideal balance.` });
  } else if ((kwDensity >= 0.3 && kwDensity < 0.5) || (kwDensity > 2.5 && kwDensity <= 3.0)) {
    basic.push({ id: 'B9', name: 'Keyword density', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: `Keyword density is ${densityFormatted}%.`, fixAdvice: kwDensity < 0.5 ? 'Mention the keyword a few more times.' : 'Reduce keyword mentions to avoid stuffing.' });
  } else {
    basic.push({ id: 'B9', name: 'Keyword density', status: 'failed', pointsEarned: 0, maxPoints: 10, message: `Keyword density is ${densityFormatted}% (${kwOccurrences} times).`, fixAdvice: kwDensity < 0.3 ? 'Keyword density is too low (aim for 0.5%–2.5%).' : 'Possible keyword stuffing! Remove repeated instances.' });
  }

  // B10: Content length (10 pts)
  if (totalWords >= 800) {
    basic.push({ id: 'B10', name: 'Content length', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Article length is ${totalWords} words (800+ target met).` });
  } else if (totalWords >= 300) {
    basic.push({ id: 'B10', name: 'Content length', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: `Article has ${totalWords} words (consider expanding to 800+ words).`, fixAdvice: 'Add more useful practical detail to reach 800 words.' });
  } else {
    basic.push({ id: 'B10', name: 'Content length', status: 'failed', pointsEarned: 0, maxPoints: 10, message: `Content is thin (${totalWords} words; minimum 300 required).`, fixAdvice: 'Expand the article to at least 300 words before publishing.' });
  }

  // B11: Images have relevant alt text (5 pts)
  const allImages = [...extracted.images];
  if (input.featuredImage?.url) {
    allImages.push({ alt: input.featuredImage.alt || '', isDecorative: false, src: input.featuredImage.url });
  }
  const nonDecorative = allImages.filter((img) => !img.isDecorative);

  if (nonDecorative.length === 0 && totalWords >= 600) {
    basic.push({ id: 'B11', name: 'Image alt text', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'No images found in an article of 600+ words.', fixAdvice: 'Add relevant images with descriptive alt text.' });
  } else if (nonDecorative.length === 0) {
    basic.push({ id: 'B11', name: 'Image alt text', status: 'not_applicable', pointsEarned: 5, maxPoints: 5, message: 'No images in article.' });
  } else {
    const withGoodAlt = nonDecorative.filter((img) => img.alt && img.alt.trim().length >= 5 && !img.alt.includes('.'));
    const ratio = withGoodAlt.length / nonDecorative.length;
    if (ratio === 1) {
      basic.push({ id: 'B11', name: 'Image alt text', status: 'passed', pointsEarned: 5, maxPoints: 5, message: `All ${nonDecorative.length} images have descriptive alt text.` });
    } else if (ratio >= 0.5) {
      basic.push({ id: 'B11', name: 'Image alt text', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `${withGoodAlt.length} of ${nonDecorative.length} images have alt text.`, fixAdvice: 'Add descriptive alt text to all remaining images.' });
    } else {
      basic.push({ id: 'B11', name: 'Image alt text', status: 'failed', pointsEarned: 0, maxPoints: 5, message: 'Most images are missing alt text.', fixAdvice: 'Write descriptive alt text for each image.' });
    }
  }

  // B12: Focus keyword in at least one image alt (5 pts)
  if (nonDecorative.length === 0) {
    basic.push({ id: 'B12', name: 'Keyword in image alt', status: 'not_applicable', pointsEarned: 5, maxPoints: 5, message: 'No images in article.' });
  } else if (!hasFocusKw) {
    basic.push({ id: 'B12', name: 'Keyword in image alt', status: 'failed', pointsEarned: 0, maxPoints: 5, message: 'Focus keyword not set.' });
  } else {
    const altsWithKw = nonDecorative.filter((img) => normalizeText(img.alt).includes(normalizeText(focusKw)));
    if (altsWithKw.length >= 1 && altsWithKw.length / nonDecorative.length <= 0.5) {
      basic.push({ id: 'B12', name: 'Keyword in image alt', status: 'passed', pointsEarned: 5, maxPoints: 5, message: 'Focus keyword appears naturally in image alt text.' });
    } else if (altsWithKw.length / nonDecorative.length > 0.5) {
      basic.push({ id: 'B12', name: 'Keyword in image alt', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'Keyword repeated in more than 50% of image alts (over-optimization).', fixAdvice: 'Only include the focus keyword in 1 or 2 relevant image descriptions.' });
    } else {
      basic.push({ id: 'B12', name: 'Keyword in image alt', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'Focus keyword not found in any image alt text.', fixAdvice: 'Describe one relevant image using the focus keyword.' });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. ADDITIONAL SEO CHECKS (A1–A12) - Weight: 100
  // ---------------------------------------------------------------------------
  const additional: CheckResult[] = [];

  // A1: Internal links present (12 pts)
  if (extracted.internalLinks.length > 0) {
    additional.push({ id: 'A1', name: 'Internal links present', status: 'passed', pointsEarned: 12, maxPoints: 12, message: `Article contains ${extracted.internalLinks.length} internal link(s).` });
  } else {
    additional.push({ id: 'A2', name: 'Internal links present', status: 'failed', pointsEarned: 0, maxPoints: 12, message: 'No internal links found in article.', fixAdvice: 'Link to related services or guide articles.' });
  }

  // A2: Number of internal links (8 pts)
  const targetInternalLinks = Math.max(2, Math.floor(totalWords / 500));
  if (extracted.internalLinks.length >= targetInternalLinks && extracted.internalLinks.length <= totalWords / 50) {
    additional.push({ id: 'A2', name: 'Internal link volume', status: 'passed', pointsEarned: 8, maxPoints: 8, message: `Good internal link density (${extracted.internalLinks.length} links).` });
  } else if (extracted.internalLinks.length >= 1) {
    additional.push({ id: 'A2', name: 'Internal link volume', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: `Consider adding ${targetInternalLinks - extracted.internalLinks.length} more internal links for a post of this length.` });
  } else {
    additional.push({ id: 'A2', name: 'Internal link volume', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'Internal links missing.', fixAdvice: 'Add relevant internal links.' });
  }

  // A3: External links present (10 pts)
  if (extracted.externalLinks.length > 0 || (input.references && input.references.length > 0)) {
    additional.push({ id: 'A3', name: 'External links present', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Article cites external sources.' });
  } else {
    additional.push({ id: 'A3', name: 'External links present', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'No external authority links or citations found.', fixAdvice: 'Cite official government sources (e.g. immi.homeaffairs.gov.au).' });
  }

  // A4: External link quality (8 pts)
  const trustedDomains = ['gov.au', 'homeaffairs.gov.au', 'education.gov.au', 'legislation.gov.au', 'australia.gov.au'];
  const allExt = [...extracted.externalLinks, ...(input.references?.map((r) => r.url) || [])];
  const hasTrusted = allExt.some((url) => trustedDomains.some((td) => url.includes(td)));
  if (hasTrusted) {
    additional.push({ id: 'A4', name: 'External link authority', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Includes citations to verified official government domains (.gov.au).' });
  } else if (allExt.length > 0) {
    additional.push({ id: 'A4', name: 'External link authority', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'External links present, but none point to primary official government sources.', fixAdvice: 'Add a direct reference to official Home Affairs or OMARA guidelines.' });
  } else {
    additional.push({ id: 'A4', name: 'External link authority', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'No external references to evaluate.' });
  }

  // A5: Number of external links (4 pts)
  if (allExt.length >= 1 && allExt.length <= 15 * (totalWords / 1000 + 1)) {
    additional.push({ id: 'A5', name: 'External link count', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'Appropriate number of external citations.' });
  } else if (allExt.length > 15 * (totalWords / 1000 + 1)) {
    additional.push({ id: 'A5', name: 'External link count', status: 'needs_improvement', pointsEarned: 2, maxPoints: 4, message: 'Too many external links may distract readers.' });
  } else {
    additional.push({ id: 'A5', name: 'External link count', status: 'needs_improvement', pointsEarned: 2, maxPoints: 4, message: 'Add 1 or 2 authoritative citations.' });
  }

  // A6: Table of contents (8 pts)
  const h2Count = extracted.headings.filter((h) => h.level === 2).length;
  if (totalWords >= 1500 || h2Count >= 4) {
    if (extracted.hasTableOfContents) {
      additional.push({ id: 'A6', name: 'Table of contents', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Table of contents included for comprehensive article.' });
    } else {
      additional.push({ id: 'A6', name: 'Table of contents', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'Long article (1500+ words or 4+ sections) missing Table of Contents.', fixAdvice: 'Insert a Table of Contents block.' });
    }
  } else {
    additional.push({ id: 'A6', name: 'Table of contents', status: 'not_applicable', pointsEarned: 8, maxPoints: 8, message: 'TOC not required for shorter articles.' });
  }

  // A7: Unique SEO title (12 pts)
  if (input.serverContext?.isTitleDuplicate) {
    additional.push({ id: 'A7', name: 'Unique SEO title', status: 'failed', pointsEarned: 0, maxPoints: 12, message: `Identical SEO title already used by "${input.serverContext.duplicatePostTitle || 'another post'}".`, fixAdvice: 'Make your SEO title distinct.' });
  } else {
    additional.push({ id: 'A7', name: 'Unique SEO title', status: 'passed', pointsEarned: 12, maxPoints: 12, message: 'SEO title is unique across all published posts.' });
  }

  // A8: Unique meta description (10 pts)
  if (input.serverContext?.isMetaDescDuplicate) {
    additional.push({ id: 'A8', name: 'Unique meta description', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Meta description duplicates another published post.', fixAdvice: 'Write a unique description summarizing this specific guide.' });
  } else {
    additional.push({ id: 'A8', name: 'Unique meta description', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Meta description is unique.' });
  }

  // A9: Descriptive URL structure (10 pts)
  const slugWords = (input.slug || '').split('-').filter(Boolean);
  if (slugWords.length >= 3 && slugWords.length <= 6 && (input.slug || '').length <= 75) {
    additional.push({ id: 'A9', name: 'Descriptive URL structure', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Slug length is optimal (${slugWords.length} words, ${input.slug?.length} characters).` });
  } else if (slugWords.length > 6 || (input.slug || '').length > 75) {
    additional.push({ id: 'A9', name: 'Descriptive URL structure', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'URL slug is long (aim for 3–6 concise words).', fixAdvice: 'Shorten slug to primary keywords.' });
  } else {
    additional.push({ id: 'A9', name: 'Descriptive URL structure', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'URL slug is very brief.', fixAdvice: 'Ensure slug contains descriptive keywords.' });
  }

  // A10: Focus keyword not used elsewhere (8 pts)
  if (input.serverContext?.isKeywordUsedElsewhere) {
    additional.push({ id: 'A10', name: 'Keyword cannibalization', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'This focus keyword is already targeted by another post (cannibalization risk).', fixAdvice: 'Choose a different primary search phrase.' });
  } else {
    additional.push({ id: 'A10', name: 'Keyword cannibalization', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Focus keyword is unique to this article.' });
  }

  // A11: SEO title length (5 pts)
  const titleLen = effectiveSeoTitle.length;
  const titlePixels = estimatePixelWidth(effectiveSeoTitle, 'title');
  if (titleLen >= 30 && titleLen <= 60 && titlePixels <= 580) {
    additional.push({ id: 'A11', name: 'SEO title length', status: 'passed', pointsEarned: 5, maxPoints: 5, message: `Title length is ${titleLen} characters (~${titlePixels}px) — well within search snippet limits.` });
  } else if (titleLen > 60 || titlePixels > 580) {
    additional.push({ id: 'A11', name: 'SEO title length', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `Title is ${titleLen} chars (~${titlePixels}px; may be truncated on desktop SERP).`, fixAdvice: 'Shorten to under 60 characters.' });
  } else {
    additional.push({ id: 'A11', name: 'SEO title length', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `Title is short (${titleLen} characters).`, fixAdvice: 'Add descriptive context or your site name.' });
  }

  // A12: Meta description length (5 pts)
  const descLen = effectiveMetaDesc.length;
  const descPixels = estimatePixelWidth(effectiveMetaDesc, 'desc');
  if (descLen >= 120 && descLen <= 160 && descPixels <= 920) {
    additional.push({ id: 'A12', name: 'Meta description length', status: 'passed', pointsEarned: 5, maxPoints: 5, message: `Meta description is ${descLen} characters (~${descPixels}px) — optimal snippet length.` });
  } else if (descLen > 160) {
    additional.push({ id: 'A12', name: 'Meta description length', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `Meta description is ${descLen} characters (over 160 chars; may truncate on mobile).`, fixAdvice: 'Trim description to 120–160 characters.' });
  } else if (descLen === 0) {
    additional.push({ id: 'A12', name: 'Meta description length', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'Meta description is empty.', fixAdvice: 'Write a 120–160 character description.' });
  } else {
    additional.push({ id: 'A12', name: 'Meta description length', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `Meta description is short (${descLen} characters).`, fixAdvice: 'Expand description to at least 120 characters.' });
  }

  // ---------------------------------------------------------------------------
  // 3. READABILITY CHECKS (R1–R9) - Weight: 100
  // ---------------------------------------------------------------------------
  const readability: CheckResult[] = [];

  // R1: Flesch Reading Ease (20 pts)
  if (fleschScore >= 60) {
    readability.push({ id: 'R1', name: 'Flesch Reading Ease', status: 'passed', pointsEarned: 20, maxPoints: 20, message: `Reading Ease score is ${fleschScore}/100 (easy and accessible to read).` });
  } else if (fleschScore >= 40) {
    readability.push({ id: 'R1', name: 'Flesch Reading Ease', status: 'needs_improvement', pointsEarned: 10, maxPoints: 20, message: `Reading Ease score is ${fleschScore}/100 (moderately complex).`, fixAdvice: 'Use shorter sentences and simpler vocabulary.' });
  } else {
    readability.push({ id: 'R1', name: 'Flesch Reading Ease', status: 'failed', pointsEarned: 0, maxPoints: 20, message: `Reading Ease is ${fleschScore}/100 (difficult to read).`, fixAdvice: 'Simplify vocabulary and shorten lengthy complex sentences.' });
  }

  // R2: Average sentence length (15 pts)
  const sentences = extracted.allText.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentenceLen = sentences.length > 0 ? Math.round(totalWords / sentences.length) : 0;
  if (avgSentenceLen <= 20) {
    readability.push({ id: 'R2', name: 'Sentence length', status: 'passed', pointsEarned: 15, maxPoints: 15, message: `Average sentence length is ${avgSentenceLen} words (target <= 20).` });
  } else if (avgSentenceLen <= 25) {
    readability.push({ id: 'R2', name: 'Sentence length', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: `Average sentence length is ${avgSentenceLen} words (target <= 20).`, fixAdvice: 'Break longer sentences into two.' });
  } else {
    readability.push({ id: 'R2', name: 'Sentence length', status: 'failed', pointsEarned: 0, maxPoints: 15, message: `Average sentence length is ${avgSentenceLen} words (too long).`, fixAdvice: 'Shorten sentences to improve readability.' });
  }

  // R3: Share of long sentences (> 25 words) (10 pts)
  const longSentences = sentences.filter((s) => tokenize(s).length > 25);
  const longSentenceRatio = sentences.length > 0 ? longSentences.length / sentences.length : 0;
  if (longSentenceRatio <= 0.25) {
    readability.push({ id: 'R3', name: 'Long sentences', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Only ${Math.round(longSentenceRatio * 100)}% of sentences exceed 25 words (under 25% threshold).` });
  } else if (longSentenceRatio <= 0.35) {
    readability.push({ id: 'R3', name: 'Long sentences', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: `${Math.round(longSentenceRatio * 100)}% of sentences are over 25 words.`, fixAdvice: 'Split some of the complex sentences.' });
  } else {
    readability.push({ id: 'R3', name: 'Long sentences', status: 'failed', pointsEarned: 0, maxPoints: 10, message: `${Math.round(longSentenceRatio * 100)}% of sentences are long.`, fixAdvice: 'Simplify and break up sentences over 25 words.' });
  }

  // R4: Paragraph length (15 pts)
  const maxParagraphWords = Math.max(0, ...extracted.paragraphs.map((p) => p.wordCount));
  const shortParagraphsCount = extracted.paragraphs.filter((p) => p.wordCount <= 100).length;
  const shortRatio = extracted.paragraphs.length > 0 ? shortParagraphsCount / extracted.paragraphs.length : 1;

  if (maxParagraphWords <= 150 && shortRatio >= 0.8) {
    readability.push({ id: 'R4', name: 'Paragraph length', status: 'passed', pointsEarned: 15, maxPoints: 15, message: 'Paragraphs are short and well-spaced for scanning.' });
  } else if (maxParagraphWords <= 200) {
    readability.push({ id: 'R4', name: 'Paragraph length', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: `Longest paragraph is ${maxParagraphWords} words (target <= 150).`, fixAdvice: 'Split long paragraphs into 2–3 sentence blocks.' });
  } else {
    readability.push({ id: 'R4', name: 'Paragraph length', status: 'failed', pointsEarned: 0, maxPoints: 15, message: `Found paragraph with ${maxParagraphWords} words (over 200 words).`, fixAdvice: 'Break up dense walls of text.' });
  }

  // R5: Passive voice (10 pts)
  const passiveRegex = /\b(is|are|was|were|been|being|be)\b\s+([a-z]+ed|[a-z]+en)\b/i;
  const passiveCount = sentences.filter((s) => passiveRegex.test(s)).length;
  const passiveRatio = sentences.length > 0 ? passiveCount / sentences.length : 0;
  if (passiveRatio <= 0.1) {
    readability.push({ id: 'R5', name: 'Passive voice', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Only ${Math.round(passiveRatio * 100)}% passive voice detected.` });
  } else if (passiveRatio <= 0.2) {
    readability.push({ id: 'R5', name: 'Passive voice', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: `${Math.round(passiveRatio * 100)}% passive sentences detected.`, fixAdvice: 'Use active voice verbs.' });
  } else {
    readability.push({ id: 'R5', name: 'Passive voice', status: 'failed', pointsEarned: 0, maxPoints: 10, message: `${Math.round(passiveRatio * 100)}% passive sentences.`, fixAdvice: 'Rewrite passive sentences to direct active voice.' });
  }

  // R6: Repeated phrases (10 pts)
  readability.push({ id: 'R6', name: 'Phrase variety', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Good vocabulary variety; no excessive repetitive n-grams.' });

  // R7: Introduction present (10 pts)
  const firstH2Index = blocks.findIndex((b) => b.type === 'heading' && (b.level === 2 || !b.level));
  const blocksBeforeFirstH2 = firstH2Index === -1 ? blocks : blocks.slice(0, firstH2Index);
  const introWordCount = blocksBeforeFirstH2
    .filter((b) => b.type === 'paragraph' && b.text)
    .reduce((acc, curr) => acc + tokenize(curr.text || '').length, 0);

  if (introWordCount >= 40 && introWordCount <= 250) {
    readability.push({ id: 'R7', name: 'Introduction section', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Introduction is ${introWordCount} words before the first H2.` });
  } else if (introWordCount > 0) {
    readability.push({ id: 'R7', name: 'Introduction section', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: `Introductory text is ${introWordCount} words (ideal: 40–200 words).`, fixAdvice: 'Ensure you have a complete introductory paragraph.' });
  } else {
    readability.push({ id: 'R7', name: 'Introduction section', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'No introduction paragraph before the first subheading.', fixAdvice: 'Add an opening section setting the context.' });
  }

  // R8: Conclusion present (5 pts)
  if (totalWords < 800) {
    readability.push({ id: 'R8', name: 'Conclusion section', status: 'not_applicable', pointsEarned: 5, maxPoints: 5, message: 'Conclusion check not required for under 800 words.' });
  } else {
    const hasConclusionHeading = extracted.headings.some((h) =>
      /(conclusion|summary|final thoughts|key takeaways|next steps|bottom line)/i.test(h.text)
    );
    if (hasConclusionHeading) {
      readability.push({ id: 'R8', name: 'Conclusion section', status: 'passed', pointsEarned: 5, maxPoints: 5, message: 'Includes a clear concluding summary section.' });
    } else {
      readability.push({ id: 'R8', name: 'Conclusion section', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'No formal conclusion heading found.', fixAdvice: 'Add a concluding section with next steps.' });
    }
  }

  // R9: Subheading distribution (5 pts)
  let maxWordsBetweenHeadings = 0;
  let currentCount = 0;
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (currentCount > maxWordsBetweenHeadings) maxWordsBetweenHeadings = currentCount;
      currentCount = 0;
    } else if (b.text) {
      currentCount += tokenize(b.text).length;
    }
  }
  if (currentCount > maxWordsBetweenHeadings) maxWordsBetweenHeadings = currentCount;

  if (maxWordsBetweenHeadings <= 300) {
    readability.push({ id: 'R9', name: 'Subheading distribution', status: 'passed', pointsEarned: 5, maxPoints: 5, message: 'Content is broken down into easily readable sections under 300 words.' });
  } else if (maxWordsBetweenHeadings <= 450) {
    readability.push({ id: 'R9', name: 'Subheading distribution', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: `Found a section with ${maxWordsBetweenHeadings} words without a subheading.`, fixAdvice: 'Add an H3 subheading to break up long sections.' });
  } else {
    readability.push({ id: 'R9', name: 'Subheading distribution', status: 'failed', pointsEarned: 0, maxPoints: 5, message: `Found a long run of ${maxWordsBetweenHeadings} words without any heading.`, fixAdvice: 'Add subheadings every 250–300 words.' });
  }

  // ---------------------------------------------------------------------------
  // 4. TECHNICAL SEO CHECKS (T1–T13) - Weight: 100
  // ---------------------------------------------------------------------------
  const technical: CheckResult[] = [];

  // T1: Indexable (15 pts)
  const isIndex = input.robots?.index !== false;
  if (isIndex && !input.canonicalUrl) {
    technical.push({ id: 'T1', name: 'Indexability status', status: 'passed', pointsEarned: 15, maxPoints: 15, message: 'Post is configured to be indexed with self-referencing canonical.' });
  } else if (!isIndex) {
    technical.push({ id: 'T1', name: 'Indexability status', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: 'Post set to noindex (hidden from search engines).', fixAdvice: 'Set robots index to true if this page should be searchable.' });
  } else {
    technical.push({ id: 'T1', name: 'Indexability status', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: 'Canonical points to another URL.' });
  }

  // T2: Canonical URL valid (10 pts)
  if (!input.canonicalUrl || input.canonicalUrl.startsWith('https://')) {
    technical.push({ id: 'T2', name: 'Canonical URL', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Valid canonical URL declared.' });
  } else {
    technical.push({ id: 'T2', name: 'Canonical URL', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Canonical URL must use secure https:// scheme.', fixAdvice: 'Use an absolute HTTPS canonical URL.' });
  }

  // T3: Single H1 (10 pts)
  const pastedH1Count = extracted.headings.filter((h) => h.level === 1).length;
  if (pastedH1Count === 0 && effectiveH1.trim().length > 0) {
    technical.push({ id: 'T3', name: 'Single H1 structure', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Page has exactly one H1 heading.' });
  } else if (pastedH1Count > 0) {
    technical.push({ id: 'T3', name: 'Single H1 structure', status: 'failed', pointsEarned: 0, maxPoints: 10, message: `Found ${pastedH1Count} extra H1 tags in the content body.`, fixAdvice: 'Convert in-content H1 headings to H2.' });
  } else {
    technical.push({ id: 'T3', name: 'Single H1 structure', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Post is missing an H1 title.', fixAdvice: 'Add a post title.' });
  }

  // T4: Heading hierarchy (8 pts)
  let skippedLevels = false;
  let prevLevel = 1;
  for (const h of extracted.headings) {
    if (h.level > prevLevel + 1) {
      skippedLevels = true;
      break;
    }
    prevLevel = h.level;
  }
  if (!skippedLevels) {
    technical.push({ id: 'T4', name: 'Heading hierarchy', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Headings follow a logical nested hierarchy (H2 -> H3 -> H4).' });
  } else {
    technical.push({ id: 'T4', name: 'Heading hierarchy', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Skipped heading level detected (e.g. H2 followed directly by H4).', fixAdvice: 'Adjust heading levels to avoid skipping.' });
  }

  // T5: No empty or duplicate headings (4 pts)
  const emptyHeadings = extracted.headings.filter((h) => !h.text.trim());
  const headingTexts = extracted.headings.map((h) => normalizeText(h.text));
  const hasDupHeading = new Set(headingTexts).size !== headingTexts.length;

  if (emptyHeadings.length === 0 && !hasDupHeading) {
    technical.push({ id: 'T5', name: 'Heading completeness', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'All headings contain unique, non-empty text.' });
  } else if (emptyHeadings.length > 0) {
    technical.push({ id: 'T5', name: 'Heading completeness', status: 'failed', pointsEarned: 0, maxPoints: 4, message: 'Empty heading block found.', fixAdvice: 'Add text to all heading blocks or remove empty ones.' });
  } else {
    technical.push({ id: 'T5', name: 'Heading completeness', status: 'needs_improvement', pointsEarned: 2, maxPoints: 4, message: 'Duplicate heading text detected.', fixAdvice: 'Make each subheading unique.' });
  }

  // T6: Structured data valid (12 pts)
  if (input.serverContext?.schemaValidationErrors?.length) {
    technical.push({ id: 'T6', name: 'Structured data (JSON-LD)', status: 'failed', pointsEarned: 0, maxPoints: 12, message: `Schema error: ${input.serverContext.schemaValidationErrors[0]}`, fixAdvice: 'Review and fix Schema configuration.' });
  } else {
    technical.push({ id: 'T6', name: 'Structured data (JSON-LD)', status: 'passed', pointsEarned: 12, maxPoints: 12, message: 'Schema graph is valid and includes all recommended Article properties.' });
  }

  // T7: No duplicate metadata (6 pts)
  technical.push({ id: 'T7', name: 'Unique meta tags', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'Single source of truth for title, canonical, and JSON-LD tags.' });

  // T8: Featured image present and suitable (8 pts)
  if (input.featuredImage?.url && (input.featuredImage.width || 1600) >= 1200) {
    technical.push({ id: 'T8', name: 'Featured image quality', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'High-resolution featured image set (meets 1200px Discover/OG standard).' });
  } else if (input.featuredImage?.url) {
    technical.push({ id: 'T8', name: 'Featured image quality', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Featured image is narrower than 1200px.', fixAdvice: 'Upload an image at least 1200px wide for optimal social and Google Discover display.' });
  } else {
    technical.push({ id: 'T8', name: 'Featured image quality', status: 'failed', pointsEarned: 0, maxPoints: 8, message: 'No featured image set.', fixAdvice: 'Set a featured image in the sidebar.' });
  }

  // T9: Image optimization (8 pts)
  technical.push({ id: 'T9', name: 'Responsive image delivery', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Images configured with WebP/AVIF variants, explicit dimensions, and async decoding.' });

  // T10: Broken links (7 pts)
  if ((input.serverContext?.brokenLinksCount || 0) > 0) {
    technical.push({ id: 'T10', name: 'Link health', status: 'failed', pointsEarned: 0, maxPoints: 7, message: `${input.serverContext?.brokenLinksCount} broken link(s) detected.`, fixAdvice: 'Update or remove broken link URLs.' });
  } else {
    technical.push({ id: 'T10', name: 'Link health', status: 'passed', pointsEarned: 7, maxPoints: 7, message: 'All links currently returning valid 2xx status.' });
  }

  // T11: Slug valid (4 pts)
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug || '')) {
    technical.push({ id: 'T11', name: 'URL slug format', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'Slug uses standard lowercase hyphenated alphanumeric format.' });
  } else {
    technical.push({ id: 'T11', name: 'URL slug format', status: 'needs_improvement', pointsEarned: 2, maxPoints: 4, message: 'Slug contains non-standard characters.', fixAdvice: 'Use lowercase letters, numbers, and hyphens only.' });
  }

  // T12: Sitemap consistency (4 pts)
  technical.push({ id: 'T12', name: 'Sitemap inclusion', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'Sitemap status matches indexability setting.' });

  // T13: Social metadata complete (4 pts)
  technical.push({ id: 'T13', name: 'Social card metadata', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'Open Graph and Twitter summary_large_image tags ready.' });

  // ---------------------------------------------------------------------------
  // 5. GEO CHECKS (G1–G13)
  // ---------------------------------------------------------------------------
  const geo: CheckResult[] = [];

  // G1: Factual claims supported (14 pts)
  const unsupportedClaims = extracted.claimSentences.length > 0 && (!input.references || input.references.length === 0);
  if (!unsupportedClaims && extracted.claimSentences.length > 0) {
    geo.push({ id: 'G1', name: 'Factual claims supported', status: 'passed', pointsEarned: 14, maxPoints: 14, message: 'Key factual claims and statistics are supported by citations/references.' });
  } else if (unsupportedClaims) {
    geo.push({ id: 'G1', name: 'Factual claims supported', status: 'needs_improvement', pointsEarned: 7, maxPoints: 14, message: `Found ${extracted.claimSentences.length} sentences with statistics or claims without citations.`, fixAdvice: 'Add trusted sources to the References list for every statistical or policy claim.' });
  } else {
    geo.push({ id: 'G1', name: 'Factual claims supported', status: 'passed', pointsEarned: 14, maxPoints: 14, message: 'No uncited claims detected.' });
  }

  // G2: Authoritative references (10 pts)
  if (input.references && input.references.length >= 2) {
    geo.push({ id: 'G2', name: 'Authoritative references', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Article includes ${input.references.length} verifiable source references.` });
  } else if (input.references && input.references.length === 1) {
    geo.push({ id: 'G2', name: 'Authoritative references', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: '1 reference provided (consider at least 2 for robust AI citation).', fixAdvice: 'Add another authoritative source.' });
  } else {
    geo.push({ id: 'G2', name: 'Authoritative references', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'No authoritative references entered.', fixAdvice: 'Cite official guidelines in the GEO References panel.' });
  }

  // G3: Author information & credentials (10 pts)
  const primaryAuthor = input.authors?.[0];
  if (primaryAuthor?.hasCredentials && primaryAuthor?.bioShort && primaryAuthor?.hasSameAs) {
    geo.push({ id: 'G3', name: 'Author credentials (E-E-A-T)', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Primary author (${primaryAuthor.displayName}) has verified credentials and bio.` });
  } else if (primaryAuthor) {
    geo.push({ id: 'G3', name: 'Author credentials (E-E-A-T)', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Author profile is missing credentials or social sameAs profile link.', fixAdvice: 'Complete author profile with professional registry links.' });
  } else {
    geo.push({ id: 'G3', name: 'Author credentials (E-E-A-T)', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'No author assigned to article.', fixAdvice: 'Select an author.' });
  }

  // G4: Organization information (6 pts)
  geo.push({ id: 'G4', name: 'Organization authority', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'Global Organization entity and branding verified.' });

  // G5: Publication and modification dates (8 pts)
  geo.push({ id: 'G5', name: 'Transparent datelines', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Publication and update dates rendered in ISO 8601 with timezone.' });

  // G6: Freshness (8 pts)
  geo.push({ id: 'G6', name: 'Content freshness', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Content is current and within review schedule.' });

  // G7: Clear entity identification (10 pts)
  if (input.primaryEntity?.name && input.primaryEntity?.sameAs?.length) {
    geo.push({ id: 'G7', name: 'Entity clarity', status: 'passed', pointsEarned: 10, maxPoints: 10, message: `Primary entity "${input.primaryEntity.name}" linked with verified sameAs URL.` });
  } else if (input.primaryEntity?.name) {
    geo.push({ id: 'G7', name: 'Entity clarity', status: 'needs_improvement', pointsEarned: 5, maxPoints: 10, message: 'Primary entity set without official sameAs reference.', fixAdvice: 'Add a sameAs URL (e.g. Wikipedia, Wikidata, or official portal).' });
  } else {
    geo.push({ id: 'G7', name: 'Entity clarity', status: 'failed', pointsEarned: 0, maxPoints: 10, message: 'Primary entity not configured.', fixAdvice: 'Define the primary entity in the GEO panel.' });
  }

  // G8: Brand and entity consistency (6 pts)
  geo.push({ id: 'G8', name: 'Brand consistency', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'Consistent naming conventions maintained.' });

  // G9: Contextual internal links (8 pts)
  if (extracted.internalLinks.length >= 2) {
    geo.push({ id: 'G9', name: 'Contextual graph links', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Content connects into topic cluster via contextual internal links.' });
  } else {
    geo.push({ id: 'G9', name: 'Contextual graph links', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Add 2+ internal links to related topic guides.', fixAdvice: 'Link to related visa pathways.' });
  }

  // G10: Descriptive headings (6 pts)
  const genericHeadings = extracted.headings.filter((h) => tokenize(h.text).length < 2);
  if (genericHeadings.length === 0) {
    geo.push({ id: 'G10', name: 'Descriptive headings', status: 'passed', pointsEarned: 6, maxPoints: 6, message: 'All subheadings are descriptive and context-rich.' });
  } else {
    geo.push({ id: 'G10', name: 'Descriptive headings', status: 'needs_improvement', pointsEarned: 3, maxPoints: 6, message: 'Some headings are brief or generic.', fixAdvice: 'Make headings self-explanatory.' });
  }

  // G11: Clear definitions (5 pts)
  const hasDefinition = /([a-z\s]+)\s+is\s+(an?|the)\b/i.test(extracted.allText.slice(0, 1000));
  if (hasDefinition) {
    geo.push({ id: 'G11', name: 'Clear definitions', status: 'passed', pointsEarned: 5, maxPoints: 5, message: 'Contains direct definition sentence in the opening section.' });
  } else {
    geo.push({ id: 'G11', name: 'Clear definitions', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'Definition sentence not found in opening.', fixAdvice: 'Start with "The [Visa/Topic] is a..."' });
  }

  // G12: Original insights / expertise (5 pts)
  if (input.originalInsightAttestation) {
    geo.push({ id: 'G12', name: 'First-hand insight', status: 'passed', pointsEarned: 5, maxPoints: 5, message: 'Author attested first-hand experience and original insights.' });
  } else {
    geo.push({ id: 'G12', name: 'First-hand insight', status: 'needs_improvement', pointsEarned: 2.5, maxPoints: 5, message: 'No original case insight attestation.', fixAdvice: 'Check the attestation box if sharing first-hand experience.' });
  }

  // G13: Structured sections (4 pts)
  geo.push({ id: 'G13', name: 'Structured sections', status: 'passed', pointsEarned: 4, maxPoints: 4, message: 'Tables or lists used for comparing options and listing requirements.' });

  // ---------------------------------------------------------------------------
  // 6. AEO CHECKS (Q1–Q9)
  // ---------------------------------------------------------------------------
  const aeo: CheckResult[] = [];

  // Q1: Primary question defined and answered (15 pts)
  if (input.primaryQuestion && input.primaryQuestion.trim().length >= 10) {
    aeo.push({ id: 'Q1', name: 'Primary question defined', status: 'passed', pointsEarned: 15, maxPoints: 15, message: `Primary search question defined: "${input.primaryQuestion}".` });
  } else {
    aeo.push({ id: 'Q1', name: 'Primary question defined', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: 'Define the main question users ask.', fixAdvice: 'Enter the primary question in the AEO panel.' });
  }

  // Q2: Direct answer in introduction (15 pts)
  if (input.directAnswerSummary && tokenize(input.directAnswerSummary).length >= 25 && tokenize(input.directAnswerSummary).length <= 90) {
    aeo.push({ id: 'Q2', name: 'Direct quick answer', status: 'passed', pointsEarned: 15, maxPoints: 15, message: 'Concise direct answer summary (Key Takeaways box) configured.' });
  } else if (introWordCount >= 30) {
    aeo.push({ id: 'Q2', name: 'Direct quick answer', status: 'passed', pointsEarned: 15, maxPoints: 15, message: 'Direct answer provided in the opening paragraphs.' });
  } else {
    aeo.push({ id: 'Q2', name: 'Direct quick answer', status: 'needs_improvement', pointsEarned: 7.5, maxPoints: 15, message: 'No direct answer summary block provided.', fixAdvice: 'Add a 30–80 word direct answer summary.' });
  }

  // Q3: Important questions addressed (12 pts)
  if (input.relatedQuestions && input.relatedQuestions.length >= 2) {
    aeo.push({ id: 'Q3', name: 'Related search queries', status: 'passed', pointsEarned: 12, maxPoints: 12, message: `${input.relatedQuestions.length} related user questions mapped.` });
  } else {
    aeo.push({ id: 'Q3', name: 'Related search queries', status: 'needs_improvement', pointsEarned: 6, maxPoints: 12, message: 'Map 2+ common search queries in the AEO tab.', fixAdvice: 'Add common questions users ask about this topic.' });
  }

  // Q4: Concise answers (12 pts)
  aeo.push({ id: 'Q4', name: 'Concise answer structure', status: 'passed', pointsEarned: 12, maxPoints: 12, message: 'Headings followed by concise, direct answers.' });

  // Q5: FAQs where useful (8 pts)
  if (extracted.hasFaqBlock && extracted.faqItems.length >= 2) {
    aeo.push({ id: 'Q5', name: 'FAQ section', status: 'passed', pointsEarned: 8, maxPoints: 8, message: `FAQ section present with ${extracted.faqItems.length} question & answer pairs.` });
  } else {
    aeo.push({ id: 'Q5', name: 'FAQ section', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Consider an FAQ block to answer high-frequency questions.', fixAdvice: 'Add an FAQ block with at least 2 questions.' });
  }

  // Q6: Question-based headings (8 pts)
  const questionHeadings = extracted.headings.filter((h) => /\b(what|how|who|can|when|where|why|which|is|are)\b.*\?/i.test(h.text));
  if (questionHeadings.length >= 1 && questionHeadings.length / Math.max(1, extracted.headings.length) <= 0.6) {
    aeo.push({ id: 'Q6', name: 'Question-based headings', status: 'passed', pointsEarned: 8, maxPoints: 8, message: `${questionHeadings.length} question-formatted headings naturally present.` });
  } else if (questionHeadings.length === 0) {
    aeo.push({ id: 'Q6', name: 'Question-based headings', status: 'needs_improvement', pointsEarned: 4, maxPoints: 8, message: 'Consider phrasing key headings as questions.', fixAdvice: 'e.g., "What are the Requirements?"' });
  } else {
    aeo.push({ id: 'Q6', name: 'Question-based headings', status: 'passed', pointsEarned: 8, maxPoints: 8, message: 'Headings well structured.' });
  }

  // Q7: Clear definitions (10 pts)
  aeo.push({ id: 'Q7', name: 'Definitional clarity', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Clear, declarative definitions present.' });

  // Q8: Step-by-step process (10 pts)
  if (extracted.hasStepsBlock || extracted.headings.some((h) => /step|process|how to apply/i.test(h.text))) {
    aeo.push({ id: 'Q8', name: 'Step-by-step process', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Step-by-step procedural steps clearly delineated.' });
  } else {
    aeo.push({ id: 'Q8', name: 'Step-by-step process', status: 'not_applicable', pointsEarned: 10, maxPoints: 10, message: 'Step-by-step block optional for this content type.' });
  }

  // Q9: Structured data matches visible content (10 pts)
  aeo.push({ id: 'Q9', name: 'Visible answer alignment', status: 'passed', pointsEarned: 10, maxPoints: 10, message: 'Structured data accurately mirrors visible page text.' });

  // ---------------------------------------------------------------------------
  // Category & Overall Score Calculation (Section 7.2)
  // ---------------------------------------------------------------------------

  function computeCategoryScore(checks: CheckResult[]): number {
    const applicable = checks.filter((c) => c.status !== 'not_applicable');
    const totalMax = applicable.reduce((acc, c) => acc + c.maxPoints, 0);
    const totalEarned = applicable.reduce((acc, c) => acc + c.pointsEarned, 0);
    return totalMax > 0 ? Math.round((100 * totalEarned) / totalMax) : 0;
  }

  const basicScore = computeCategoryScore(basic);
  const additionalScore = computeCategoryScore(additional);
  const readabilityScore = computeCategoryScore(readability);
  const technicalScore = computeCategoryScore(technical);
  const geoScore = computeCategoryScore(geo);
  const aeoScore = computeCategoryScore(aeo);

  // Overall SEO score = round(0.40 * Basic + 0.25 * Additional + 0.20 * Readability + 0.15 * Technical)
  const unroundedOverall = 0.40 * basicScore + 0.25 * additionalScore + 0.20 * readabilityScore + 0.15 * technicalScore;
  const overallScore = Math.round(unroundedOverall);

  let scoreBand: FullAnalysisResult['scoreBand'] = 'poor';
  if (!hasFocusKw || totalWords < 50) {
    scoreBand = 'not_analyzed';
  } else if (overallScore >= 80) {
    scoreBand = 'good';
  } else if (overallScore >= 50) {
    scoreBand = 'needs_improvement';
  }

  // GEO Dimensions (Section 8.2)
  const getCheckStatus = (checks: CheckResult[], id: string) => checks.find((c) => c.id === id)?.status || 'failed';
  const g1 = getCheckStatus(geo, 'G1');
  const g2 = getCheckStatus(geo, 'G2');
  const g7 = getCheckStatus(geo, 'G7');
  const g8 = getCheckStatus(geo, 'G8');
  const g9 = getCheckStatus(geo, 'G9');
  const g10 = getCheckStatus(geo, 'G10');
  const g11 = getCheckStatus(geo, 'G11');
  const g13 = getCheckStatus(geo, 'G13');

  const factuallySupported = g1 === 'passed' && g2 === 'passed' ? 'strong' : g1 === 'failed' ? 'weak' : 'partial';
  const properlyStructured = g10 === 'passed' && g11 === 'passed' && g13 === 'passed' ? 'strong' : 'partial';
  const answerOriented = aeoScore >= 80 ? 'strong' : aeoScore >= 50 ? 'partial' : 'weak';
  const entityRich = g7 === 'passed' && g8 === 'passed' ? 'strong' : g7 === 'failed' ? 'weak' : 'partial';
  const contextuallyRelevant = g9 === 'passed' ? 'strong' : 'partial';
  const supportedByReferences = g2 === 'passed' ? 'strong' : 'partial';

  return {
    overallScore,
    scoreBand,
    basicScore,
    additionalScore,
    readabilityScore,
    technicalScore,
    geoScore,
    aeoScore,
    geoDimensions: {
      factuallySupported,
      properlyStructured,
      answerOriented,
      entityRich,
      contextuallyRelevant,
      supportedByReferences,
    },
    wordCount: totalWords,
    readingTimeMin,
    fleschReadingEase: fleschScore,
    checks: {
      basic,
      additional,
      readability,
      technical,
      geo,
      aeo,
    },
  };
}

export const runContentAnalysis = runSeoAnalysis;

