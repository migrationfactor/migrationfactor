import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { AppSettings } from './settings';
import type { InvoiceWithItems } from './service';
import { businessToday, effectiveStatus, formatInvoiceDate, formatMoney, lineTotals } from './totals';

// Migration Factor palette.
const PRIMARY = rgb(0x0b / 255, 0x66 / 255, 0x6a / 255);
const DARK = rgb(0x04 / 255, 0x26 / 255, 0x28 / 255);
const ACCENT = rgb(0x35 / 255, 0xb5 / 255, 0xac / 255);
const GREY = rgb(0.36, 0.42, 0.43);
const LIGHT = rgb(0.95, 0.97, 0.97);
const BORDER = rgb(0.84, 0.9, 0.9);
const WHITE = rgb(1, 1, 1);

const STATUS_COLOURS: Record<string, RGB> = {
  paid: rgb(0.13, 0.55, 0.3),
  draft: rgb(0.5, 0.55, 0.56),
  sent: rgb(0.13, 0.4, 0.75),
  overdue: rgb(0.75, 0.15, 0.2),
  cancelled: rgb(0.5, 0.55, 0.56),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const CONTENT_W = PAGE_W - M * 2;

/** Standard PDF fonts only cover Windows-1252; replace anything else so drawing never throws. */
function safe(font: PDFFont, value: string | null | undefined): string {
  let out = '';
  for (const ch of String(value ?? '').replace(/\r/g, '')) {
    if (ch === '\n') { out += ch; continue; }
    try { font.encodeText(ch); out += ch; } catch { out += '?'; }
  }
  return out;
}

function wrap(font: PDFFont, value: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(font, value).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      // Break words longer than the column.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function generateInvoicePdf(invoice: InvoiceWithItems, settings: AppSettings, today = businessToday()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${invoice.invoice_number} — ${settings.business_name}`);
  pdf.setAuthor(settings.business_name);
  pdf.setCreator(settings.business_name);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fm = (n: number) => formatMoney(n, invoice.currency);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  const text = (p: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont = regular, color: RGB = DARK) =>
    p.drawText(safe(font, value), { x, y, size, font, color });
  const right = (p: PDFPage, value: string, xRight: number, y: number, size: number, font: PDFFont = regular, color: RGB = DARK) =>
    text(p, value, xRight - font.widthOfTextAtSize(safe(font, value), size), y, size, font, color);

  // 1. Header
  let y = PAGE_H - M - 20;
  const nameLines = wrap(bold, settings.business_name, 20, CONTENT_W * 0.58);
  nameLines.forEach((line, i) => text(page, line, M, y - i * 22, 20, bold, PRIMARY));
  right(page, 'INVOICE', PAGE_W - M, y, 26, bold, DARK);
  right(page, `# ${invoice.invoice_number}`, PAGE_W - M, y - 18, 10, bold, GREY);

  const status = effectiveStatus(invoice.status, invoice.due_date, invoice.balance_due, today);
  const badge = status.toUpperCase();
  const badgeW = bold.widthOfTextAtSize(badge, 8.5) + 16;
  page.drawRectangle({ x: PAGE_W - M - badgeW, y: y - 42, width: badgeW, height: 16, color: STATUS_COLOURS[status] ?? GREY });
  text(page, badge, PAGE_W - M - badgeW + 8, y - 37, 8.5, bold, WHITE);

  y -= nameLines.length * 22 - 4;
  const headerLines = [
    [settings.tagline, settings.registration_number].filter(Boolean).join(' | '),
    settings.office_address || '',
    [settings.contact_email, settings.contact_phone].filter(Boolean).join(' | '),
  ].filter(Boolean);
  for (const line of headerLines) {
    for (const part of wrap(regular, line, 8.5, CONTENT_W * 0.58)) { text(page, part, M, y, 8.5, regular, GREY); y -= 11.5; }
  }
  y = Math.min(y, PAGE_H - M - 70) - 14;
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: BORDER });
  y -= 22;

  // 2. Bill to + invoice facts
  const colTop = y;
  text(page, 'BILL TO', M, y, 8.5, bold, GREY);
  y -= 15;
  text(page, invoice.bill_to_name, M, y, 11, bold);
  y -= 13;
  for (const line of [invoice.bill_to_email, invoice.bill_to_phone || '', ...(invoice.bill_to_address ? wrap(regular, invoice.bill_to_address, 9, CONTENT_W * 0.5) : [])].filter(Boolean)) {
    text(page, line, M, y, 9, regular, GREY); y -= 12;
  }
  let ry = colTop;
  const labelX = PAGE_W - M - 210;
  const facts: [string, string, boolean][] = [
    ['Invoice Date', formatInvoiceDate(invoice.invoice_date), false],
    ['Due Date', formatInvoiceDate(invoice.due_date), false],
    ['Terms', invoice.terms, false],
    ['Balance Due', fm(invoice.balance_due), true],
  ];
  for (const [label, value, strong] of facts) {
    if (strong) page.drawRectangle({ x: labelX - 8, y: ry - 6, width: 218, height: 20, color: LIGHT });
    text(page, `${label}:`, labelX, ry, strong ? 10 : 9, strong ? bold : regular, strong ? DARK : GREY);
    right(page, value, PAGE_W - M, ry, strong ? 11 : 9, strong ? bold : regular, strong ? PRIMARY : DARK);
    ry -= strong ? 24 : 16;
  }
  y = Math.min(y, ry) - 18;

  // 3. Item table
  const cols = [
    { key: '#', w: 0.05 }, { key: 'Item & Description', w: 0.36 }, { key: 'Qty', w: 0.09 }, { key: 'Rate', w: 0.13 },
    { key: 'Discount', w: 0.11 }, { key: 'Tax', w: 0.11 }, { key: 'Amount', w: 0.15 },
  ].map((c) => ({ ...c, w: c.w * CONTENT_W }));
  const colX: number[] = [];
  cols.reduce((x, c) => { colX.push(x); return x + c.w; }, M);
  const PAD = 6;
  const drawHeader = () => {
    page.drawRectangle({ x: M, y: y - 8, width: CONTENT_W, height: 24, color: PRIMARY });
    cols.forEach((c, i) => {
      if (i <= 1) text(page, c.key, colX[i] + PAD, y, 9, bold, WHITE);
      else right(page, c.key, colX[i] + c.w - PAD, y, 9, bold, WHITE);
    });
    y -= 24;
  };
  const FOOTER_SPACE = 60;
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M - 10;
    text(page, `${settings.business_name} — ${invoice.invoice_number} (continued)`, M, y, 9, bold, GREY);
    y -= 26;
  };
  drawHeader();

  invoice.line_items.forEach((line, index) => {
    const t = lineTotals(line);
    const nameLines = wrap(bold, line.item_name, 9.5, cols[1].w - PAD * 2);
    const descLines = line.description ? wrap(regular, line.description, 8, cols[1].w - PAD * 2) : [];
    const rowH = Math.max(24, 10 + nameLines.length * 12 + descLines.length * 10 + 4);
    if (y - rowH < M + FOOTER_SPACE) { newPage(); drawHeader(); }
    const top = y + 14;
    if (index % 2 === 1) page.drawRectangle({ x: M, y: top - rowH, width: CONTENT_W, height: rowH, color: LIGHT });
    page.drawLine({ start: { x: M, y: top - rowH }, end: { x: PAGE_W - M, y: top - rowH }, thickness: 0.6, color: BORDER });
    const baseline = top - 15;
    text(page, String(index + 1), colX[0] + PAD, baseline, 9, regular, GREY);
    let ly = baseline;
    nameLines.forEach((l) => { text(page, l, colX[1] + PAD, ly, 9.5, bold); ly -= 12; });
    descLines.forEach((l) => { text(page, l, colX[1] + PAD, ly, 8, regular, GREY); ly -= 10; });
    const cells = [
      String(Number(line.quantity.toFixed(2))),
      fm(line.rate),
      line.discount_percent ? `${Number(line.discount_percent)}%` : '-',
      line.tax_percent ? `${Number(line.tax_percent)}%` : '-',
      fm(t.amount),
    ];
    cells.forEach((value, i) => right(page, value, colX[i + 2] + cols[i + 2].w - PAD, baseline, 9, i === 4 ? bold : regular));
    y -= rowH;
  });
  y -= 10;

  // 4. Totals
  const rows: [string, string, 'normal' | 'total' | 'balance'][] = [['Sub Total', fm(invoice.subtotal), 'normal']];
  if (invoice.discount_total > 0) rows.push(['Discount', `-${fm(invoice.discount_total)}`, 'normal']);
  if (invoice.tax_total > 0) rows.push(['Tax', fm(invoice.tax_total), 'normal']);
  rows.push(['Total', fm(invoice.total), 'total']);
  rows.push(['Payment Made', invoice.amount_paid > 0 ? `(-) ${fm(invoice.amount_paid)}` : fm(0), 'normal']);
  rows.push(['Balance Due', fm(invoice.balance_due), 'balance']);
  const totalsH = rows.length * 20 + 20;
  if (y - totalsH < M + FOOTER_SPACE) newPage();
  const tLabelX = PAGE_W - M - 230;
  for (const [label, value, kind] of rows) {
    if (kind === 'total') {
      // The rule sits above the text's cap height rather than through it.
      page.drawLine({ start: { x: tLabelX, y: y + 14 }, end: { x: PAGE_W - M, y: y + 14 }, thickness: 1, color: BORDER });
      y -= 4;
    }
    if (kind === 'balance') page.drawRectangle({ x: tLabelX - 8, y: y - 7, width: 238, height: 22, color: LIGHT });
    const strong = kind !== 'normal';
    text(page, label, tLabelX, y, strong ? 10.5 : 9.5, strong ? bold : regular, strong ? DARK : GREY);
    right(page, value, PAGE_W - M - (kind === 'balance' ? 4 : 0), y, strong ? 10.5 : 9.5, strong ? bold : regular, kind === 'balance' ? PRIMARY : DARK);
    y -= kind === 'total' ? 22 : 20;
  }
  y -= 12;

  // 5. Notes
  if (invoice.notes) {
    const noteLines = wrap(regular, invoice.notes, 9, CONTENT_W);
    if (y - (noteLines.length * 12 + 20) < M + 30) newPage();
    text(page, 'NOTES', M, y, 8.5, bold, GREY);
    y -= 14;
    for (const line of noteLines) {
      if (y < M + 30) { newPage(); }
      text(page, line, M, y, 9, regular, DARK); y -= 12;
    }
  }

  // 6. Footer on every page
  const website = (settings.website_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const footer = safe(regular, `Thank you for your business${website ? ` | ${website}` : ''}`);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 14 }, end: { x: PAGE_W - M, y: M + 14 }, thickness: 0.6, color: ACCENT });
    p.drawText(footer, { x: (PAGE_W - regular.widthOfTextAtSize(footer, 8.5)) / 2, y: M, size: 8.5, font: regular, color: GREY });
    if (pages.length > 1) right(p, `Page ${i + 1} of ${pages.length}`, PAGE_W - M, M, 8, regular, GREY);
  });

  return pdf.save();
}
