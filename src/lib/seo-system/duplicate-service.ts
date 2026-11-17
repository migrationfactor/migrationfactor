import { query, queryOne } from './db';

const shingles = (html: string): Set<string> => {
  const words = (html || '').replace(/<[^>]*>/g, ' ').toLowerCase().match(/[a-z0-9]+/g) || [];
  const out = new Set<string>();
  for (let i = 0; i + 5 <= words.length; i++) out.add(words.slice(i, i + 5).join(' '));
  return out;
};

/** Jaccard similarity of 5-word shingles (FR-QLT-006). Returns other posts that are 40% or more similar. */
export async function findNearDuplicates(postId: string, threshold = 0.4) {
  const me = await queryOne<{ body_html: string }>(`SELECT body_html FROM public.seo_posts WHERE id = $1`, [postId]);
  if (!me?.body_html) return [];
  const a = shingles(me.body_html);
  if (a.size < 20) return [];
  const others = await query<{ id: string; title: string; slug: string; legacy_path: string | null; body_html: string }>(
    `SELECT id, title, slug, legacy_path, body_html FROM public.seo_posts WHERE id <> $1 AND status IN ('published','draft','pending_review','scheduled') AND body_html IS NOT NULL`,
    [postId]
  );
  const result: Array<{ id: string; title: string; path: string; similarity: number }> = [];
  for (const o of others) {
    const b = shingles(o.body_html);
    if (b.size < 20) continue;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const sim = inter / (a.size + b.size - inter);
    if (sim >= threshold) result.push({ id: o.id, title: o.title, path: o.legacy_path || `/blog/${o.slug}`, similarity: Math.round(sim * 100) });
  }
  return result.sort((x, y) => y.similarity - x.similarity).slice(0, 10);
}
