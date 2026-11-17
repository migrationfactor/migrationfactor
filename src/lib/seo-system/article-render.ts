/**
 * Render-time enhancements for stored article HTML (pure, no database):
 * - responsive AVIF/WebP <picture> markup for local images (served by the Next.js image optimizer)
 * - automatic table of contents (FR-EDT-005) when enabled in settings
 * All output is plain server-rendered HTML; nothing depends on client JavaScript.
 */

const WIDTHS = [640, 828, 1080];
const SIZES = '(max-width: 768px) 100vw, 768px';

export function optimizedUrl(src: string, width: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

export function isOptimizableSrc(src: string): boolean {
  return src.startsWith('/') && !src.startsWith('//') && /\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(src);
}

const srcset = (src: string) => WIDTHS.map((w) => `${optimizedUrl(src, w)} ${w}w`).join(', ');

/** Wraps local <img> tags in <picture> with AVIF and WebP sources; keeps the original as the fallback. */
export function optimizeContentImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*?)\/?>/gi, (full, before: string, rawSrc: string, after: string) => {
    const src = rawSrc.replace(/&amp;/g, '&');
    if (!isOptimizableSrc(src) || /<picture/i.test(before)) return full;
    const attrs = `${before}${after}`;
    const hasSizes = /\bsizes=/.test(attrs);
    const sources =
      `<source type="image/avif" srcset="${srcset(src)}" sizes="${SIZES}">` +
      `<source type="image/webp" srcset="${srcset(src)}" sizes="${SIZES}">`;
    const img = `<img${before}src="${rawSrc}"${after}${hasSizes ? '' : ` sizes="${SIZES}"`} srcset="${srcset(src)}">`;
    return `<picture>${sources}${img}</picture>`;
  });
}

interface Heading {
  level: number;
  id: string;
  text: string;
}

export function extractHeadings(html: string): Heading[] {
  const out: Heading[] = [];
  const re = /<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]*>/g, '').trim();
    if (text) out.push({ level: Number(m[1]), id: m[2], text });
  }
  return out;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tocHtml(headings: Heading[]): string {
  const items = headings
    .map((h) => `    <li class="toc-item toc-level-${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`)
    .join('\n');
  return `<nav class="table-of-contents" aria-label="Table of contents">\n  <p class="toc-title">Table of Contents</p>\n  <ol class="toc-list">\n${items}\n  </ol>\n</nav>`;
}

/** Adds an automatic TOC before the first H2 when the setting is on and the post is long enough. */
export function addAutoToc(html: string, minH2: number): string {
  if (!minH2 || html.includes('class="table-of-contents"')) return html;
  const headings = extractHeadings(html);
  if (headings.filter((h) => h.level === 2).length < minH2) return html;
  const firstH2 = html.search(/<h2\b/i);
  if (firstH2 < 0) return html;
  return html.slice(0, firstH2) + tocHtml(headings) + '\n' + html.slice(firstH2);
}

export function renderArticleBody(html: string, opts: { autoTocMinH2?: number } = {}): string {
  return optimizeContentImages(addAutoToc(html, opts.autoTocMinH2 || 0));
}
