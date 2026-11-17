import { wpGet, wpUrl } from './wordpress-client';

export interface WpMedia {
  id: number;
  source_url: string;
  alt_text: string;
  caption?: { rendered: string };
  title?: { rendered: string };
  mime_type: string;
  media_details?: { width?: number; height?: number; filesize?: number; file?: string };
}

/** Fetch media items by ID in chunks (the `include` filter is capped by per_page). */
export async function fetchMediaByIds(ids: number[]): Promise<WpMedia[]> {
  const unique = [...new Set(ids.filter((id) => id > 0))];
  const out: WpMedia[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const res = await wpGet<WpMedia[]>(wpUrl('media', { include: chunk.join(','), per_page: 100, _fields: 'id,source_url,alt_text,caption,title,mime_type,media_details' }));
    out.push(...res.data);
  }
  return out;
}
