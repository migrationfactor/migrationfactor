import { query, queryOne } from './db';
import { logAudit } from './audit';
import { DEFAULT_SETTINGS, SeoSettings, normalizeSettings } from './settings-defaults';

const KEY = 'general';
let cache: { at: number; value: SeoSettings } | null = null;

export async function getSeoSettings(): Promise<SeoSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value = DEFAULT_SETTINGS;
  try {
    const row = await queryOne<{ value: any }>(`SELECT value FROM public.seo_settings WHERE key = $1`, [KEY]);
    if (row?.value) value = normalizeSettings(row.value, DEFAULT_SETTINGS);
  } catch {
    value = DEFAULT_SETTINGS; // a bad stored value must never take the blog down
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Posts whose title/description come from the template (no manual value) and would change. */
export async function countTemplateDependentPosts(): Promise<{ titles: number; descriptions: number; examples: string[] }> {
  const [t] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id
     WHERE p.status IN ('published','scheduled') AND coalesce(trim(s.seo_title_raw), '') = ''`
  );
  const [d] = await query<{ n: string }>(
    `SELECT count(*) AS n FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id
     WHERE p.status IN ('published','scheduled') AND coalesce(trim(s.meta_description_raw), '') = ''`
  );
  const ex = await query<{ title: string }>(
    `SELECT p.title FROM public.seo_post_seo s JOIN public.seo_posts p ON p.id = s.post_id
     WHERE p.status IN ('published','scheduled') AND coalesce(trim(s.seo_title_raw), '') = '' LIMIT 5`
  );
  return { titles: Number(t.n), descriptions: Number(d.n), examples: ex.map((e) => e.title) };
}

/**
 * Saves settings. Template changes that would alter posts without a manual value need
 * `confirmed` (Principle 3: no silent changes); manual values are never touched.
 */
export async function saveSeoSettings(patch: unknown, userId: string, confirmed: boolean) {
  const current = await getSeoSettings();
  const next = normalizeSettings(patch, current);
  const templateChanged =
    next.titleTemplate !== current.titleTemplate ||
    next.titleSeparator !== current.titleSeparator ||
    next.siteName !== current.siteName ||
    next.descriptionTemplate !== current.descriptionTemplate;

  if (templateChanged && !confirmed) {
    const impact = await countTemplateDependentPosts();
    if (impact.titles > 0 || (next.descriptionTemplate !== current.descriptionTemplate && impact.descriptions > 0)) {
      return { saved: false as const, needsConfirmation: true as const, impact };
    }
  }

  await query(
    `INSERT INTO public.seo_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [KEY, JSON.stringify(next), userId]
  );
  await query(`INSERT INTO public.seo_settings_history (key, value, changed_by) VALUES ($1, $2, $3)`, [KEY, JSON.stringify(next), userId]);
  await logAudit({ actorId: userId, action: 'settings.seo_update', entityType: 'settings', beforeState: current as any, afterState: next as any });
  cache = null;
  return { saved: true as const, settings: next };
}

export async function getSettingsHistory(limit = 20) {
  return query(
    `SELECT h.id, h.changed_at, h.value, u.email AS changed_by
     FROM public.seo_settings_history h LEFT JOIN public.seo_users u ON u.id = h.changed_by
     WHERE h.key = $1 ORDER BY h.changed_at DESC LIMIT $2`,
    [KEY, limit]
  );
}
