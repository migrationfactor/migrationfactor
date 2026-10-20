import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { formatSignDate, isImageField, splitName, type SignField } from './fields';

const INK = rgb(0x04 / 255, 0x26 / 255, 0x28 / 255);
const PRIMARY = rgb(0x0b / 255, 0x66 / 255, 0x6a / 255);
const LIGHT = rgb(0.95, 0.98, 0.98);
const BORDER = rgb(0.21, 0.71, 0.67);
const GREY = rgb(0.3, 0.38, 0.39);

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
  return pdf.getPageCount();
}

/** Copies every page of every PDF into one document, in order. */
export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 1) return files[0];
  const merged = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(file);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

function safe(font: PDFFont, value: string): string {
  let out = '';
  for (const ch of value.replace(/[\r\n]+/g, ' ')) {
    try { font.encodeText(ch); out += ch; } catch { out += '?'; }
  }
  return out;
}

/** Shrinks text until it fits the box width. */
function fitText(font: PDFFont, text: string, size: number, width: number): [string, number] {
  let s = size;
  while (s > 6 && font.widthOfTextAtSize(text, s) > width) s -= 0.5;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t, s) > width) t = t.slice(0, -1);
  return [t, s];
}

function drawImageInBox(page: PDFPage, image: PDFImage, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / image.width, h / image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;
  page.drawImage(image, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
}

export interface StampInput {
  fields: SignField[];
  signaturePng: Uint8Array;
  initialPng: Uint8Array | null;
  signer: { name: string; email: string };
  audit: { signedAt: Date; ip: string; documentId: string; requestId: string; businessName: string };
}

/**
 * Draws one signer's fields onto the current PDF (which may already hold earlier signatures).
 * Field boxes are percentages with a top-left origin; PDF space has a bottom-left origin.
 */
export async function stampSignature(pdfBytes: Uint8Array, input: StampInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signature = await pdf.embedPng(input.signaturePng);
  const initial = input.initialPng ? await pdf.embedPng(input.initialPng) : signature;
  const pages = pdf.getPages();
  const { first, last } = splitName(input.signer.name);

  if (!input.fields.length) {
    drawAuditBlock(pages[pages.length - 1], signature, font, bold, input);
    return pdf.save();
  }

  for (const field of input.fields) {
    const page = pages[field.page - 1];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const x = (field.x / 100) * W;
    const w = (field.w / 100) * W;
    const h = (field.h / 100) * H;
    const y = ((100 - field.y - field.h) / 100) * H;

    if (isImageField(field.type)) {
      if (field.value) drawImageInBox(page, field.type === 'initial' ? initial : signature, x, y, w, h);
      continue;
    }
    if (field.type === 'checkbox') {
      const size = Math.min(w, h);
      page.drawRectangle({ x, y: y + (h - size) / 2, width: size, height: size, borderColor: INK, borderWidth: 0.8 });
      if (field.value === true) {
        const pad = size * 0.2;
        const by = y + (h - size) / 2;
        page.drawLine({ start: { x: x + pad, y: by + pad }, end: { x: x + size - pad, y: by + size - pad }, thickness: 1.2, color: INK });
        page.drawLine({ start: { x: x + pad, y: by + size - pad }, end: { x: x + size - pad, y: by + pad }, thickness: 1.2, color: INK });
      }
      continue;
    }
    const defaults: Record<string, string> = {
      sign_date: formatSignDate(input.audit.signedAt), full_name: input.signer.name,
      first_name: first, last_name: last, email: input.signer.email, text: '',
    };
    const raw = typeof field.value === 'string' && field.value ? field.value : defaults[field.type] ?? '';
    if (!raw) continue;
    const [text, size] = fitText(font, safe(font, raw), Math.max(8, h * 0.5), w);
    page.drawText(text, { x, y: y + (h - size * 0.72) / 2, size, font, color: INK });
  }
  return pdf.save();
}

function drawAuditBlock(page: PDFPage, signature: PDFImage, font: PDFFont, bold: PDFFont, input: StampInput) {
  const { width: W } = page.getSize();
  const boxW = Math.min(W - 72, 470);
  const boxH = 132;
  const x = (W - boxW) / 2;
  const y = 40;
  page.drawRectangle({ x, y, width: boxW, height: boxH, color: LIGHT, borderColor: BORDER, borderWidth: 1 });
  page.drawText('DIGITALLY SIGNED', { x: x + 14, y: y + boxH - 20, size: 10, font: bold, color: PRIMARY });
  drawImageInBox(page, signature, x + 14, y + 16, boxW * 0.34, boxH - 46);
  const rows: [string, string][] = [
    ['Signed by', input.signer.name],
    ['Email', input.signer.email],
    ['Signed at (UTC)', input.audit.signedAt.toISOString().replace('T', ' ').slice(0, 19)],
    ['IP address', input.audit.ip || 'unknown'],
    ['Document ID', input.audit.documentId],
    ['Request ID', input.audit.requestId],
  ];
  const tx = x + boxW * 0.4;
  const valueWidth = boxW * 0.6 - 92;
  rows.forEach(([label, value], i) => {
    const ry = y + boxH - 22 - i * 14;
    page.drawText(`${label}:`, { x: tx, y: ry, size: 7.5, font: bold, color: GREY });
    const [text, size] = fitText(font, safe(font, value), 7.5, valueWidth);
    page.drawText(text, { x: tx + 78, y: ry, size, font, color: INK });
  });
  page.drawText(safe(font, `Verified by ${input.audit.businessName} Digital Signature System`), { x: tx, y: y + 10, size: 7, font, color: GREY });
}
