import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getAutosave, saveAutosave } from '@/lib/seo-system/workflow-service';

// Autosaves never touch live content (FR-BLG-002); they live in seo_post_autosaves per user.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.edit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  return NextResponse.json((await getAutosave(id, auth!.userId)) || { snapshot: null });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.edit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid_body' }, { status: 422 });
  return NextResponse.json(await saveAutosave(id, auth!.userId, body));
}
