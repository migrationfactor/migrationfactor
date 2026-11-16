import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getMedia, updateMedia, deleteMedia } from '@/lib/seo-system/media-service';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: Context) {
  const { errorResponse } = await authenticateApiRequest(req, 'media.upload');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const item = await getMedia(id);
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, context: Context) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media.edit');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  try {
    const body = await req.json();
    const updated = await updateMedia(id, auth!.userId, body);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: 'update_failed', message: err.message }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media.delete');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  try {
    await deleteMedia(id, auth!.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'delete_failed', message: err.message, usage: err.usage },
      { status: err.status || 400 }
    );
  }
}
