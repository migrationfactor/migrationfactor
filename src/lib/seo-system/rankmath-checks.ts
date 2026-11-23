/**
 * The checklist shown in the editor's SEO box (Basic SEO, Additional, Title Readability, Content Readability).
 * Pure functions so they run live in the browser and in tests. Wording follows the familiar Rank Math checklist.
 */

export type CheckStatus = 'passed' | 'needs_improvement' | 'failed';
export interface ListCheck {
  id: string;
  status: CheckStatus;
  message: string;
  tip?: string;
}

export interface ChecklistInput {
  focusKeyword: string;
  seoTitle: string;
  metaDescription: string;
  /** Full public URL of the post. */
  url: string;
  bodyHtml: string;
  /** Times the same focus keyword is already used on other posts. */
  keywordUsedBefore: number;
  siteHost?: string;
}

const text = (html: string) => html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const countOf = (haystack: string, needle: string) => (needle ? haystack.split(needle).length - 1 : 0);
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const POWER_WORDS = ['complete', 'ultimate', 'proven', 'essential', 'guide', 'best', 'new', 'free', 'easy', 'secret', 'fast', 'guaranteed', 'official', 'updated', 'simple', 'top', 'step', 'powerful', 'amazing', 'effective'];
const SENTIMENT = /\b(best|great|easy|ultimate|complete|essential|proven|simple|free|top|worst|avoid|mistakes?|risks?|fail(s|ed|ure)?|problems?|hard|costly|common|need|should|never|always|must)\b/i;

function links(html: string, host: string) {
  const out: Array<{ internal: boolean; nofollow: boolean }> = [];
  const re = /<a\s+([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(m[1])?.[1] || '';
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    const abs = /^https?:\/\//i.test(href);
    const internal = !abs || new RegExp('^https?://(www\\.)?' + host.replace(/\./g, '\\.'), 'i').test(href);
    const rel = /rel\s*=\s*["']([^"']*)["']/i.exec(m[1])?.[1] || '';
    out.push({ internal, nofollow: /\b(nofollow|sponsored|ugc)\b/i.test(rel) });
  }
  return out;
}

export function buildChecklist(i: ChecklistInput): { basic: ListCheck[]; additional: ListCheck[]; titleReadability: ListCheck[]; contentReadability: ListCheck[] } {
  const kw = i.focusKeyword.trim().toLowerCase();
  const title = i.seoTitle.trim();
  const body = text(i.bodyHtml);
  const bodyLower = body.toLowerCase();
  const wordList = words(body);
  const host = i.siteHost || 'migrationfactor.com';

  const inTitle = kw && title.toLowerCase().includes(kw);
  const inDesc = kw && i.metaDescription.toLowerCase().includes(kw);
  const inUrl = kw && (i.url.toLowerCase().includes(slugify(kw)) || kw.split(/\s+/).every((w) => i.url.toLowerCase().includes(slugify(w))));
  const first10 = bodyLower.slice(0, Math.max(1, Math.floor(bodyLower.length * 0.1)));
  const inFirst = kw && first10.includes(kw);
  const inContent = kw && bodyLower.includes(kw);
  const wc = wordList.length;

  const basic: ListCheck[] = [
    inTitle
      ? { id: 'b1', status: 'passed', message: "Hurray! You're using Focus Keyword in the SEO Title." }
      : { id: 'b1', status: 'failed', message: 'Add Focus Keyword to the SEO title.', tip: 'Make sure the focus keyword appears in the SEO title, ideally near the beginning.' },
    inDesc
      ? { id: 'b2', status: 'passed', message: 'Focus Keyword used inside SEO Meta Description.' }
      : { id: 'b2', status: 'failed', message: 'Add Focus Keyword to your SEO Meta Description.', tip: 'Make sure the focus keyword appears in the meta description.' },
    inUrl
      ? { id: 'b3', status: 'passed', message: 'Focus Keyword used in the URL.' }
      : { id: 'b3', status: 'failed', message: 'Use Focus Keyword in the URL.', tip: 'Include the focus keyword in the post URL.' },
    inFirst
      ? { id: 'b4', status: 'passed', message: 'Focus Keyword appears in the first 10% of the content.' }
      : { id: 'b4', status: 'failed', message: 'Use Focus Keyword at the beginning of your content.', tip: 'Mention the focus keyword in the first paragraph.' },
    inContent
      ? { id: 'b5', status: 'passed', message: 'Focus Keyword found in the content.' }
      : { id: 'b5', status: 'failed', message: 'Use Focus Keyword in the content.', tip: 'Use the focus keyword naturally in your content.' },
    wc >= 600
      ? { id: 'b6', status: 'passed', message: `Content is ${wc} words long. Good job!` }
      : { id: 'b6', status: 'failed', message: `Content is ${wc} words long. Consider using at least 600 words.`, tip: 'Longer, in-depth content usually performs better.' },
  ];

  // ---- Additional ----
  const headings = Array.from(i.bodyHtml.matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi)).map((m) => text(m[1]).toLowerCase());
  const inSubheading = kw && headings.some((h) => h.includes(kw));
  const imgAlts = Array.from(i.bodyHtml.matchAll(/<img\b[^>]*\balt\s*=\s*["']([^"']*)["']/gi)).map((m) => m[1].toLowerCase());
  const inAlt = kw && imgAlts.some((a) => a.includes(kw));
  const kwCount = kw ? countOf(bodyLower, kw) : 0;
  const density = kw && wc ? Math.round(((kwCount * kw.split(/\s+/).length) / wc) * 10000) / 100 : 0;
  const urlLen = i.url.length;
  const ls = links(i.bodyHtml, host);
  const external = ls.filter((l) => !l.internal);
  const internal = ls.filter((l) => l.internal);

  let densityCheck: ListCheck;
  if (!kw || kwCount === 0) densityCheck = { id: 'a3', status: 'failed', message: 'Keyword Density is 0. Aim for around 1% Keyword Density.', tip: 'Use the focus keyword a few more times in a natural way.' };
  else if (density < 1) densityCheck = { id: 'a3', status: 'needs_improvement', message: `Keyword Density is ${density}, the Focus Keyword and combination appears ${kwCount} times.` };
  else if (density <= 2.5) densityCheck = { id: 'a3', status: 'passed', message: `Keyword Density is ${density}, the Focus Keyword and combination appears ${kwCount} times.` };
  else densityCheck = { id: 'a3', status: 'failed', message: `Keyword Density is ${density}, the Focus Keyword and combination appears ${kwCount} times. Aim for around 1% Keyword Density.` };

  const additional: ListCheck[] = [
    inSubheading
      ? { id: 'a1', status: 'passed', message: 'Focus Keyword found in the subheading(s).' }
      : { id: 'a1', status: 'failed', message: 'Use Focus Keyword in subheading(s) like H2, H3, H4, etc..' },
    inAlt
      ? { id: 'a2', status: 'passed', message: 'Focus Keyword found in image alt attribute(s).' }
      : { id: 'a2', status: 'failed', message: 'Add an image with your Focus Keyword as alt text.' },
    densityCheck,
    urlLen <= 75
      ? { id: 'a4', status: 'passed', message: `URL is ${urlLen} characters long. Kudos!` }
      : { id: 'a4', status: 'failed', message: `URL is ${urlLen} characters long. Consider shortening it.` },
    external.length
      ? { id: 'a5', status: 'passed', message: 'Great! You are linking to external resources.' }
      : { id: 'a5', status: 'failed', message: 'Link out to external resources.' },
    external.some((l) => !l.nofollow)
      ? { id: 'a6', status: 'passed', message: 'At least one external link with DoFollow found in your content.' }
      : { id: 'a6', status: 'failed', message: 'Add DoFollow links pointing to external resources.' },
    internal.length
      ? { id: 'a7', status: 'passed', message: 'You are linking to other resources on your website which is great.' }
      : { id: 'a7', status: 'failed', message: "We couldn't find any internal links in your content. Add some internal links to lead the reader to relevant resources." },
    !kw
      ? { id: 'a8', status: 'failed', message: 'Set a Focus Keyword for this content.' }
      : i.keywordUsedBefore === 0
        ? { id: 'a8', status: 'passed', message: "You haven't used this Focus Keyword before." }
        : { id: 'a8', status: 'failed', message: `You've used this Focus Keyword ${i.keywordUsedBefore} time${i.keywordUsedBefore > 1 ? 's' : ''} before, it's best to only use it once.` },
  ];

  // ---- Title readability ----
  const tl = title.toLowerCase();
  const power = POWER_WORDS.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(title)).length;
  const titleReadability: ListCheck[] = [
    kw && tl.startsWith(kw)
      ? { id: 't1', status: 'passed', message: 'Focus Keyword used at the beginning of SEO title.' }
      : { id: 't1', status: 'failed', message: 'Use the Focus Keyword near the beginning of SEO title.' },
    SENTIMENT.test(title)
      ? { id: 't2', status: 'passed', message: 'Your title has a positive or a negative sentiment.' }
      : { id: 't2', status: 'failed', message: "Your title doesn't contain a positive or negative sentiment word." },
    power > 0
      ? { id: 't3', status: 'passed', message: `Your title contains ${power} power word(s). Booyah!` }
      : { id: 't3', status: 'failed', message: "Your title doesn't contain a power word. Add at least one." },
    /\d/.test(title)
      ? { id: 't4', status: 'passed', message: 'Your SEO title contains a number.' }
      : { id: 't4', status: 'failed', message: "Your SEO title doesn't contain a number." },
  ];

  // ---- Content readability ----
  const hasToc = /TOC_PLACEHOLDER|table of contents|class\s*=\s*["'][^"']*\btoc\b|id\s*=\s*["']toc/i.test(i.bodyHtml);
  const paragraphs = Array.from(i.bodyHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => words(text(m[1])).length);
  const longPara = paragraphs.some((n) => n > 120);
  const hasMedia = /<(img|video|iframe)\b|youtube\.com|youtu\.be|vimeo\.com/i.test(i.bodyHtml);
  const contentReadability: ListCheck[] = [
    hasToc
      ? { id: 'c1', status: 'passed', message: 'You seem to be using a Table of Contents to break-down your text.' }
      : { id: 'c1', status: 'failed', message: "You don't seem to be using a Table of Contents to break-down your text." },
    longPara
      ? { id: 'c2', status: 'failed', message: 'At least one of your paragraphs is long. Consider using short paragraphs.' }
      : { id: 'c2', status: 'passed', message: 'You are using short paragraphs.' },
    hasMedia
      ? { id: 'c3', status: 'passed', message: 'Your content contains images and/or video(s).' }
      : { id: 'c3', status: 'failed', message: 'You are not using rich media like images or videos.' },
  ];

  return { basic, additional, titleReadability, contentReadability };
}
