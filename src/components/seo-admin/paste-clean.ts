/**
 * Paste cleanup (FR-EDT-006): converts pasted rich text (Word, Google Docs, web pages) into clean blocks.
 * Headings, lists, tables, links and bold/italic are kept; styles, fonts, classes, comments, tracking
 * parameters and empty paragraphs are dropped; a pasted H1 becomes an H2. Runs in the browser only.
 */

export interface PasteReport {
  h1Converted: number;
  stylesRemoved: number;
  blocks: number;
}

const INLINE_OK = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'CODE', 'SUP', 'SUB', 'A', 'BR']);

function cleanHref(href: string): string | null {
  if (!href || /^\s*(javascript|data|vbscript):/i.test(href)) return null;
  try {
    const u = new URL(href, 'https://migrationfactor.com');
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gclid|fbclid|mc_)/i.test(k)) u.searchParams.delete(k);
    return /^https?:/i.test(href) ? u.toString() : href;
  } catch {
    return href;
  }
}

function inlineHtml(node: Node, report: PasteReport): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent || '').replace(/ +/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (el.getAttribute('style')) report.stylesRemoved++;
      const inner = inlineHtml(el, report);
      const tag = el.tagName;
      if (tag === 'SPAN' && /font-weight:\s*(bold|[6-9]00)/i.test(el.getAttribute('style') || '')) out += `<strong>${inner}</strong>`;
      else if (tag === 'SPAN' && /font-style:\s*italic/i.test(el.getAttribute('style') || '')) out += `<em>${inner}</em>`;
      else if (tag === 'A') {
        const href = cleanHref(el.getAttribute('href') || '');
        out += href ? `<a href="${href.replace(/"/g, '&quot;')}">${inner}</a>` : inner;
      } else if (tag === 'BR') out += '<br>';
      else if (INLINE_OK.has(tag)) {
        const t = tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase();
        out += `<${t}>${inner}</${t}>`;
      } else out += inner;
    }
  });
  return out;
}

export function htmlToBlocks(html: string): { blocks: any[]; report: PasteReport } {
  const report: PasteReport = { h1Converted: 0, stylesRemoved: 0, blocks: 0 };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: any[] = [];

  const walk = (parent: Element) => {
    parent.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        const t = (child.textContent || '').trim();
        if (t) blocks.push({ type: 'paragraph', data: { text: t.replace(/&/g, '&amp;').replace(/</g, '&lt;') } });
        return;
      }
      const el = child as HTMLElement;
      if (el.getAttribute('style')) report.stylesRemoved++;
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) {
        let level = Number(tag[1]);
        if (level === 1) {
          level = 2;
          report.h1Converted++;
        }
        const text = (el.textContent || '').trim();
        if (text) blocks.push({ type: 'heading', data: { level: Math.min(4, level), text } });
      } else if (tag === 'P') {
        const text = inlineHtml(el, report).replace(/(<br>)+$/g, '').trim();
        if (text && text !== '<br>') blocks.push({ type: 'paragraph', data: { text } });
      } else if (tag === 'UL' || tag === 'OL') {
        const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => inlineHtml(li, report).trim()).filter(Boolean);
        if (items.length) blocks.push({ type: 'list', data: { style: tag === 'OL' ? 'ordered' : 'unordered', items } });
      } else if (tag === 'TABLE') {
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => inlineHtml(c, report).trim()));
        if (rows.length) blocks.push({ type: 'table', data: { withHeaderRow: Boolean(el.querySelector('th')) || true, content: rows, caption: el.querySelector('caption')?.textContent?.trim() || '' } });
      } else if (tag === 'BLOCKQUOTE') {
        const text = (el.textContent || '').trim();
        if (text) blocks.push({ type: 'quote', data: { text } });
      } else if (tag === 'PRE') {
        blocks.push({ type: 'code', data: { code: el.textContent || '', language: '' } });
      } else if (tag === 'HR') {
        blocks.push({ type: 'divider', data: {} });
      } else if (tag === 'IMG') {
        // Images are never hot-linked: the editor asks for an upload instead.
      } else if (['DIV', 'SECTION', 'ARTICLE', 'BODY', 'MAIN', 'SPAN', 'B', 'FONT'].includes(tag)) {
        if (el.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,pre')) walk(el);
        else {
          const text = inlineHtml(el, report).trim();
          if (text) blocks.push({ type: 'paragraph', data: { text } });
        }
      }
    });
  };
  walk(doc.body);
  report.blocks = blocks.length;
  return { blocks, report };
}

export function describeReport(r: PasteReport): string {
  const parts: string[] = [];
  if (r.h1Converted) parts.push(`${r.h1Converted} H1 converted to H2`);
  if (r.stylesRemoved) parts.push(`${r.stylesRemoved} inline styles removed`);
  return `Pasted content cleaned: ${r.blocks} block${r.blocks === 1 ? '' : 's'}${parts.length ? ', ' + parts.join(', ') : ''}`;
}
