import { buildChecklist, type ChecklistInput, type ListCheck } from './rankmath-checks';

/**
 * 100-mark SEO scoring sheet (a custom framework, not Rank Math's official weighting):
 *   Basic SEO 30 | Additional SEO 30 | Title Readability 15 | Content Readability 15 | Technical & Linking SEO 10
 */

export interface ScoreInput extends ChecklistInput {
  robotsIndex?: boolean;
  canonicalUrl?: string;
  /** True when an Article / BlogPosting schema is generated for the post. */
  articleSchema?: boolean;
  /** Links in the body whose last check returned an error status. */
  brokenLinks?: number;
}

export interface ScoreItem { label: string; max: number; earned: number }
export interface ScoreCategory { name: string; max: number; earned: number; items: ScoreItem[] }
export type Grade = 'Excellent' | 'Very Good' | 'Good' | 'Needs Improvement' | 'Poor';
export interface SeoScore { total: number; grade: Grade; categories: ScoreCategory[] }

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Needs Improvement';
  return 'Poor';
}

const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean);

export function scoreSeo(i: ScoreInput): SeoScore {
  const c = buildChecklist(i);
  const ok = (list: ListCheck[], id: string) => list.find((x) => x.id === id)?.status === 'passed';
  const half = (list: ListCheck[], id: string) => list.find((x) => x.id === id)?.status === 'needs_improvement';
  const pts = (max: number, full: boolean, partial = false) => (full ? max : partial ? Math.round(max / 2) : 0);

  const kw = i.focusKeyword.trim().toLowerCase();
  const html = i.bodyHtml;
  const wc = words(text(html)).length;

  const firstPara = text(/<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] || '').toLowerCase();
  const inFirstPara = Boolean(kw) && (firstPara.includes(kw) || ok(c.basic, 'b4'));
  const h23 = Array.from(html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)).map((m) => text(m[1]).toLowerCase());
  const inH23 = Boolean(kw) && h23.some((h) => h.includes(kw));
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/gi)).map((m) => m[0]);
  const imgsWithAlt = imgs.filter((t) => /\balt\s*=\s*["'][^"']+["']/i.test(t)).length;
  const subheads = (html.match(/<h[2-4]\b/gi) || []).length;
  const hasList = /<(ul|ol)\b/i.test(html);
  const structureTarget = Math.max(2, Math.floor(wc / 400));
  const urlLen = i.url.length;
  const mobileOk = !/<(font|marquee|center)\b/i.test(html) && !/(?:width|min-width)\s*[:=]\s*["']?\d{4,}/i.test(html);
  const canonical = (i.canonicalUrl || '').trim();
  const canonicalOk = !canonical || /^https:\/\/[^\s/]+\.[^\s]+$/i.test(canonical);

  const basic: ScoreItem[] = [
    { label: 'Focus keyword in SEO title', max: 5, earned: pts(5, ok(c.basic, 'b1')) },
    { label: 'Focus keyword in meta description', max: 5, earned: pts(5, ok(c.basic, 'b2')) },
    { label: 'Focus keyword in URL', max: 4, earned: pts(4, ok(c.basic, 'b3')) },
    { label: 'Focus keyword in first paragraph', max: 4, earned: pts(4, inFirstPara) },
    { label: 'Focus keyword in content', max: 4, earned: pts(4, ok(c.basic, 'b5')) },
    { label: 'Keyword in H2/H3', max: 4, earned: pts(4, inH23) },
    { label: 'Content length', max: 4, earned: pts(4, wc >= 600, wc >= 300) },
  ];
  const additional: ScoreItem[] = [
    { label: 'Keyword density', max: 5, earned: pts(5, ok(c.additional, 'a3'), half(c.additional, 'a3')) },
    { label: 'Keyword in image ALT', max: 4, earned: pts(4, ok(c.additional, 'a2')) },
    { label: 'Internal linking', max: 5, earned: pts(5, ok(c.additional, 'a7')) },
    { label: 'External linking', max: 5, earned: pts(5, ok(c.additional, 'a5')) },
    { label: 'Relevant images', max: 3, earned: pts(3, imgsWithAlt > 0, imgs.length > 0) },
    { label: 'Short URL', max: 3, earned: pts(3, urlLen <= 75, urlLen <= 100) },
    { label: 'Focus keyword uniqueness', max: 5, earned: pts(5, ok(c.additional, 'a8')) },
  ];
  const title: ScoreItem[] = [
    { label: 'Power word in title', max: 4, earned: pts(4, ok(c.titleReadability, 't3')) },
    { label: 'Number in title', max: 3, earned: pts(3, ok(c.titleReadability, 't4')) },
    { label: 'Positive/negative sentiment', max: 3, earned: pts(3, ok(c.titleReadability, 't2')) },
    { label: 'Focus keyword at beginning', max: 5, earned: pts(5, ok(c.titleReadability, 't1'), Boolean(kw) && i.seoTitle.toLowerCase().includes(kw)) },
  ];
  const content: ScoreItem[] = [
    { label: 'Table of Contents', max: 4, earned: pts(4, ok(c.contentReadability, 'c1')) },
    { label: 'Short paragraphs', max: 4, earned: pts(4, ok(c.contentReadability, 'c2')) },
    { label: 'Images or videos', max: 4, earned: pts(4, ok(c.contentReadability, 'c3')) },
    { label: 'Easy-to-read content structure', max: 3, earned: pts(3, subheads >= structureTarget && (hasList || wc < 300 || subheads >= structureTarget + 2), subheads >= 1) },
  ];
  const technical: ScoreItem[] = [
    { label: 'Appropriate Article Schema', max: 3, earned: pts(3, i.articleSchema !== false) },
    { label: 'Mobile-friendly formatting', max: 2, earned: pts(2, mobileOk) },
    { label: 'Working internal/external links', max: 2, earned: pts(2, (i.brokenLinks || 0) === 0) },
    { label: 'Indexability and canonical checks', max: 3, earned: (i.robotsIndex === false ? 0 : 2) + (canonicalOk ? 1 : 0) },
  ];

  const mk = (name: string, items: ScoreItem[]): ScoreCategory => ({ name, max: items.reduce((a, b) => a + b.max, 0), earned: items.reduce((a, b) => a + b.earned, 0), items });
  const categories = [
    mk('Basic SEO', basic),
    mk('Additional SEO', additional),
    mk('Title Readability', title),
    mk('Content Readability', content),
    mk('Technical & Linking SEO', technical),
  ];
  const total = categories.reduce((a, b) => a + b.earned, 0);
  return { total, grade: gradeFor(total), categories };
}
