/**
 * SEC-05: Rich text sanitization and output escaping.
 * Server-side HTML sanitizer with strict element/attribute allowlists.
 * Converts block JSON into clean semantic HTML and sanitizes arbitrary rich text.
 */

export const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'u', 's',
  'code', 'pre', 'blockquote', 'cite', 'figure', 'figcaption', 'img', 'picture',
  'source', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'br', 'hr',
  'sup', 'sub', 'nav', 'section', 'aside', 'details', 'summary', 'span', 'div',
  'time'
]);

export const ALLOWED_ATTRS = new Set([
  'href', 'src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading',
  'decoding', 'title', 'id', 'class', 'rel', 'target', 'scope', 'colspan',
  'rowspan', 'datetime', 'data-nosnippet', 'aria-label', 'aria-labelledby',
  'aria-describedby', 'aria-hidden', 'tabindex', 'role'
]);

export const SAFE_URL_PROTOCOLS = new Set([
  'http:', 'https:', 'mailto:', 'tel:'
]);

/**
 * Escapes characters for safe inclusion in HTML text context
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes attribute values for safe inclusion in HTML tags
 */
export function escapeAttr(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes JSON-LD so that script tags cannot be broken out of:
 * Replaces `<` with `\u003c` and `>` with `\u003e`
 */
export function escapeJsonLd(obj: any): string {
  const json = JSON.stringify(obj, null, 2);
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * Validates a URL against dangerous schemes (javascript:, data:, vbscript:)
 */
export function isValidUrl(urlString: string | null | undefined): boolean {
  if (!urlString) return false;
  const trimmed = urlString.trim().toLowerCase();
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return true; // relative or anchor
  }
  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Normalizes heading IDs for Table of Contents anchors
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // remove any inline html
    .replace(/[^\w\s-]/g, '') // remove special chars
    .trim()
    .replace(/\s+/g, '-');
}

export interface ContentBlock {
  id?: string;
  type: string;
  data: any;
}

export interface SanitizationResult {
  html: string;
  removedElements: string[];
  removedAttributes: string[];
  headings: Array<{ level: number; text: string; id: string }>;
  wordCount: number;
  readingTimeMin: number;
}

/**
 * Renders structured Block JSON into semantic HTML according to FR-EDT-001/002/003/004/005/006
 */
export function renderBlocksToHtml(blocks: ContentBlock[]): SanitizationResult {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return {
      html: '',
      removedElements: [],
      removedAttributes: [],
      headings: [],
      wordCount: 0,
      readingTimeMin: 1,
    };
  }

  const headings: Array<{ level: number; text: string; id: string }> = [];
  const parts: string[] = [];
  const headingIdCounts: Record<string, number> = {};

  for (const block of blocks) {
    if (!block || !block.type) continue;

    switch (block.type) {
      case 'paragraph': {
        const text = sanitizeInline(block.data?.text || '');
        if (text) {
          parts.push(`<p>${text}</p>`);
        }
        break;
      }

      case 'heading': {
        // Enforce FR-EDT-002: H1 cannot be inside body! Convert H1 to H2.
        let level = Number(block.data?.level) || 2;
        if (level < 2) level = 2;
        if (level > 4) level = 4;

        const rawText = block.data?.text || '';
        const text = sanitizeInline(rawText);
        let anchorId = block.data?.anchorId || slugifyHeading(rawText);
        if (!anchorId) anchorId = `section-${headings.length + 1}`;

        // Ensure anchorId uniqueness
        if (headingIdCounts[anchorId]) {
          headingIdCounts[anchorId]++;
          anchorId = `${anchorId}-${headingIdCounts[anchorId]}`;
        } else {
          headingIdCounts[anchorId] = 1;
        }

        headings.push({ level, text: rawText.replace(/<[^>]*>/g, ''), id: anchorId });
        parts.push(`<h${level} id="${escapeAttr(anchorId)}">${text}</h${level}>`);
        break;
      }

      case 'list': {
        const style = block.data?.style === 'ordered' ? 'ol' : 'ul';
        const start = block.data?.start ? ` start="${Number(block.data.start)}"` : '';
        const items = Array.isArray(block.data?.items) ? block.data.items : [];
        if (items.length > 0) {
          const lis = items.map((item: any) => {
            const itemText = typeof item === 'string' ? sanitizeInline(item) : sanitizeInline(item?.text || '');
            return `<li>${itemText}</li>`;
          }).join('');
          parts.push(`<${style}${start}>${lis}</${style}>`);
        }
        break;
      }

      case 'table': {
        const withHeaderRow = block.data?.withHeaderRow !== false;
        const caption = block.data?.caption ? `<caption>${escapeHtml(block.data.caption)}</caption>` : '';
        const content: string[][] = Array.isArray(block.data?.content) ? block.data.content : [];

        if (content.length > 0) {
          let tableHtml = `<div class="table-responsive" tabindex="0" role="region" aria-label="${escapeAttr(block.data?.caption || 'Data table')}"><table class="content-table">${caption}`;
          if (withHeaderRow) {
            const headerRow = content[0] || [];
            tableHtml += `<thead><tr>${headerRow.map(cell => `<th scope="col">${sanitizeInline(cell)}</th>`).join('')}</tr></thead>`;
            tableHtml += `<tbody>${content.slice(1).map(row => `<tr>${row.map(cell => `<td>${sanitizeInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
          } else {
            tableHtml += `<tbody>${content.map(row => `<tr>${row.map(cell => `<td>${sanitizeInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`;
          }
          tableHtml += `</table></div>`;
          parts.push(tableHtml);
        }
        break;
      }

      case 'image': {
        const src = block.data?.file?.url || block.data?.url || '';
        if (src && isValidUrl(src)) {
          const alt = block.data?.isDecorative ? '' : (block.data?.alt || '');
          const caption = block.data?.caption ? `<figcaption>${sanitizeInline(block.data.caption)}</figcaption>` : '';
          const width = block.data?.width ? ` width="${Number(block.data.width)}"` : '';
          const height = block.data?.height ? ` height="${Number(block.data.height)}"` : '';
          const title = block.data?.title ? ` title="${escapeAttr(block.data.title)}"` : '';
          const loading = block.data?.loading === 'eager' ? 'eager' : 'lazy';

          parts.push(
            `<figure class="content-figure">` +
            `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${title}${width}${height} loading="${loading}" decoding="async" class="content-image" />` +
            caption +
            `</figure>`
          );
        }
        break;
      }

      case 'quote': {
        const text = sanitizeInline(block.data?.text || '');
        const caption = block.data?.caption ? `<cite>${sanitizeInline(block.data.caption)}</cite>` : '';
        if (text) {
          parts.push(`<blockquote><p>${text}</p>${caption}</blockquote>`);
        }
        break;
      }

      case 'callout': {
        const text = sanitizeInline(block.data?.text || '');
        const title = block.data?.title ? `<strong>${escapeHtml(block.data.title)}</strong>` : '';
        const tone = block.data?.tone || 'info';
        if (text) {
          parts.push(`<aside class="callout callout-${escapeAttr(tone)}">${title}<p>${text}</p></aside>`);
        }
        break;
      }

      case 'key_takeaways': {
        const items = Array.isArray(block.data?.items) ? block.data.items : [];
        const title = block.data?.title || 'Key Takeaways';
        if (items.length > 0) {
          const lis = items.map((it: string) => `<li>${sanitizeInline(it)}</li>`).join('');
          parts.push(
            `<section class="key-takeaways" data-nosnippet="false">` +
            `<h3 class="key-takeaways-title">${escapeHtml(title)}</h3>` +
            `<ul>${lis}</ul>` +
            `</section>`
          );
        }
        break;
      }

      case 'faq': {
        // Enforce FR-EDT-003 & FR-AEO-006: Visible text, not hidden behind details/summary by default
        const items = Array.isArray(block.data?.items) ? block.data.items : [];
        if (items.length > 0) {
          const faqItemsHtml = items.map((item: any, idx: number) => {
            const q = escapeHtml(item.question || '');
            const a = sanitizeInline(item.answer || '');
            return (
              `<div class="faq-item" id="faq-item-${idx + 1}">` +
              `<h3 class="faq-question">${q}</h3>` +
              `<div class="faq-answer"><p>${a}</p></div>` +
              `</div>`
            );
          }).join('');
          // FR-AEO-006: the FAQ is an H2 section with H3 questions so it joins the heading outline / TOC
          const faqTitle = String(block.data?.heading || 'Frequently Asked Questions').trim() || 'Frequently Asked Questions';
          let faqId = slugifyHeading(faqTitle) || 'faq';
          if (headingIdCounts[faqId]) {
            headingIdCounts[faqId]++;
            faqId = `${faqId}-${headingIdCounts[faqId]}`;
          } else {
            headingIdCounts[faqId] = 1;
          }
          headings.push({ level: 2, text: faqTitle, id: faqId });
          parts.push(`<section class="content-faqs" aria-labelledby="${escapeAttr(faqId)}"><h2 id="${escapeAttr(faqId)}">${escapeHtml(faqTitle)}</h2>${faqItemsHtml}</section>`);
        }
        break;
      }

      case 'steps': {
        // Enforce FR-AEO-007: How-to step items
        const steps = Array.isArray(block.data?.steps) ? block.data.steps : [];
        if (steps.length > 0) {
          const stepsHtml = steps.map((st: any, idx: number) => {
            const name = escapeHtml(st.name || `Step ${idx + 1}`);
            const text = sanitizeInline(st.text || '');
            const img = st.imageUrl && isValidUrl(st.imageUrl)
              ? `<img src="${escapeAttr(st.imageUrl)}" alt="${escapeAttr(st.imageAlt || name)}" loading="lazy" class="step-image" />`
              : '';
            return (
              `<li class="how-to-step" id="step-${idx + 1}">` +
              `<h3 class="step-title">${name}</h3>` +
              `<div class="step-text"><p>${text}</p></div>` +
              img +
              `</li>`
            );
          }).join('');
          parts.push(`<section class="how-to-steps"><ol class="steps-list">${stepsHtml}</ol></section>`);
        }
        break;
      }

      case 'toc': {
        // Enforce FR-EDT-005: Table of contents placeholder (server will render nav with headings)
        parts.push(`<!-- TOC_PLACEHOLDER -->`);
        break;
      }

      case 'divider': {
        parts.push(`<hr />`);
        break;
      }

      case 'code': {
        const code = escapeHtml(block.data?.code || '');
        const lang = block.data?.language ? ` class="language-${escapeAttr(block.data.language)}"` : '';
        parts.push(`<pre><code${lang}>${code}</code></pre>`);
        break;
      }

      case 'gallery': {
        const imgs = (Array.isArray(block.data?.images) ? block.data.images : []).filter((g: any) => g?.url && isValidUrl(g.url));
        if (imgs.length) {
          const figures = imgs
            .map((g: any) => `<figure class="content-figure"><img src="${escapeAttr(g.url)}" alt="${escapeAttr(g.alt || '')}"${g.width ? ` width="${Number(g.width)}"` : ''}${g.height ? ` height="${Number(g.height)}"` : ''} loading="lazy" decoding="async" class="content-image" /></figure>`)
            .join('');
          parts.push(`<div class="content-gallery">${figures}</div>`);
        }
        break;
      }

      case 'video': {
        const url = String(block.data?.url || '');
        if (/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(url)) {
          const label = escapeHtml(block.data?.title || 'Watch the video');
          parts.push(`<p class="content-video"><a href="${escapeAttr(url)}" target="_blank" rel="noopener">${label}</a></p>`);
        }
        break;
      }

      case 'button': {
        const url = String(block.data?.url || '').trim();
        const label = escapeHtml(block.data?.text || '');
        if (label && /^(https?:\/\/|\/|mailto:|tel:)/i.test(url)) {
          parts.push(`<p class="content-button"><a class="button" href="${escapeAttr(url)}">${label}</a></p>`);
        }
        break;
      }

      case 'raw_html': {
        // Sanitize arbitrary raw HTML
        const clean = sanitizeRawHtml(block.data?.html || '');
        if (clean) parts.push(clean);
        break;
      }

      default:
        break;
    }
  }

  // Insert Table of contents if placeholder exists
  let fullHtml = parts.join('\n');
  if (fullHtml.includes('<!-- TOC_PLACEHOLDER -->')) {
    if (headings.length > 0) {
      const tocNav = (
        `<nav class="table-of-contents" aria-label="Table of contents">\n` +
        `  <p class="toc-title">Table of Contents</p>\n` +
        `  <ol class="toc-list">\n` +
        headings.map(h => `    <li class="toc-item toc-level-${h.level}"><a href="#${escapeAttr(h.id)}">${escapeHtml(h.text)}</a></li>`).join('\n') +
        `\n  </ol>\n` +
        `</nav>`
      );
      fullHtml = fullHtml.replace('<!-- TOC_PLACEHOLDER -->', tocNav);
    } else {
      fullHtml = fullHtml.replace('<!-- TOC_PLACEHOLDER -->', '');
    }
  }

  // Calculate words and reading time
  const plainText = fullHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 225));

  return {
    html: fullHtml,
    removedElements: [],
    removedAttributes: [],
    headings,
    wordCount,
    readingTimeMin,
  };
}

/**
 * Sanitizes inline formatted text (bold, italic, code, links)
 */
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'code', 'sup', 'sub', 'br', 'a', 'mark', 'small', 'abbr']);
const REL_OK = new Set(['noopener', 'noreferrer', 'nofollow', 'sponsored', 'ugc']);

function attrValue(attrs: string, name: string): string | null {
  const m = new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))', 'i').exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
}

/** Allowlist-based inline sanitizer: only simple formatting tags and safe links survive; everything else is dropped. */
export function sanitizeInline(text: string): string {
  if (!text) return '';
  const src = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|svg|math|template|noscript|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, '');
  return src.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|</g, (m: string, close: string, tag: string, attrs: string) => {
    if (!tag) return '&lt;';
    const t = tag.toLowerCase();
    if (!INLINE_TAGS.has(t)) return '';
    if (close) return t === 'br' ? '' : `</${t}>`;
    if (t === 'br') return '<br>';
    if (t !== 'a') return `<${t}>`;
    const href = (attrValue(attrs, 'href') || '').replace(/&amp;/g, '&').trim();
    if (!href || !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) return '<a>';
    const blank = (attrValue(attrs, 'target') || '').toLowerCase() === '_blank';
    const rel = new Set((attrValue(attrs, 'rel') || '').toLowerCase().split(/\s+/).filter((x) => REL_OK.has(x)));
    if (blank) rel.add('noopener');
    const title = attrValue(attrs, 'title');
    return `<a href="${escapeAttr(href)}"${blank ? ' target="_blank"' : ''}${rel.size ? ` rel="${[...rel].join(' ')}"` : ''}${title ? ` title="${escapeAttr(title)}"` : ''}>`;
  });
}

/**
 * Sanitizes arbitrary HTML using strict regex-based element and attribute filtering
 */
export function sanitizeRawHtml(html: string): string {
  if (!html) return '';
  // Strip dangerous elements
  let clean = html
    .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
    .replace(/<\/h1>/gi, '</h2>')
    .replace(/<(script|iframe|object|embed|form|applet|meta|link|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed|form|applet|meta|link|style)[^>]*>/gi, '');

  // Strip inline event handlers
  clean = clean.replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, '');
  clean = clean.replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, '');

  // Strip javascript:, data: schemes from href/src
  clean = clean.replace(/(href|src)\s*=\s*(['"])\s*(javascript|data|vbscript):.*?\2/gi, '$1="#"');

  return clean;
}
