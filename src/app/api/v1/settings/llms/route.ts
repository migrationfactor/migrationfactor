import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import { logAudit } from '@/lib/seo-system/audit';

const KEY = 'llms';
const DEFAULTS = { enabled: false, content: '', searchGenerativeAi: '', recordedAt: null as string | null };

async function getLlmsSettings() {
  const row = await queryOne<{ value: any }>(`SELECT value FROM public.seo_settings WHERE key = $1`, [KEY]);
  return { ...DEFAULTS, ...(row?.value || {}) };
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  return NextResponse.json(await getLlmsSettings());
}

export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'robots.edit');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  const current = await getLlmsSettings();
  const generative = ['', 'include', 'exclude'].includes(body.searchGenerativeAi) ? body.searchGenerativeAi : '';
  const next = {
    enabled: Boolean(body.enabled),
    content: String(body.content || '').slice(0, 50_000),
    searchGenerativeAi: generative,
    recordedAt: generative !== current.searchGenerativeAi ? new Date().toISOString() : current.recordedAt,
  };
  await query(
    `INSERT INTO public.seo_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [KEY, JSON.stringify(next), auth!.userId]
  );
  await logAudit({ actorId: auth!.userId, action: 'settings.llms_update', entityType: 'settings', beforeState: current as any, afterState: next as any });
  return NextResponse.json(next);
}
