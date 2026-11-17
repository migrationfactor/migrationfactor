/**
 * Reads real image type and pixel size from file bytes (SEC-06: never trust the extension or
 * the browser-supplied MIME type). Supports JPEG, PNG, WebP and AVIF. Pure, no dependencies.
 */
export interface ImageMeta {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  width: number;
  height: number;
}

export function readImageMeta(buf: Buffer): ImageMeta | null {
  if (buf.length < 16) return null;

  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buf.length < 24) return null;
    return { mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // JPEG: walk segments until a Start-Of-Frame marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++;
        continue;
      }
      if (marker >= 0xd0 && marker <= 0xd9) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }

  // WebP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buf.length >= 30) {
      return { mime: 'image/webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (chunk === 'VP8 ' && buf.length >= 30) {
      return { mime: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && buf.length >= 25) {
      const b = buf.readUInt32LE(21);
      return { mime: 'image/webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }

  // AVIF: ISO-BMFF 'ftyp' with an avif brand, size from the first 'ispe' box
  if (buf.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(buf.toString('ascii', 8, 32))) {
    const at = buf.indexOf('ispe', 0, 'ascii');
    if (at > 0 && buf.length >= at + 16) {
      return { mime: 'image/avif', width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
    }
    return null;
  }

  return null;
}

/** Rules from FR-MED-001: featured images need at least 1200 px width. */
export const MIN_FEATURED_WIDTH = 1200;
