import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getSeoSettings, getSettingsHistory, saveSeoSettings } from '@/lib/seo-system/settings-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'settings.seo_global');
  if (errorResponse) return errorResponse;
  return NextResponse.json({ settings: await getSeoSettings(), history: await getSettingsHistory() });
}

/**
 * Saves global SEO settings. If a template change would alter posts that have no manual value,
 * the first call returns `needsConfirmation` with the impact; resend with `confirm: true`.
 */
export async function PUT(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'settings.seo_global');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await saveSeoSettings(body.settings, auth!.userId, Boolean(body.confirm));
    return NextResponse.json(result, { status: result.saved ? 200 : 409 });
  } catch (err: any) {
    return NextResponse.json({ error: 'validation_failed', message: err.message }, { status: err.status || 500 });
  }
}
