import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { onPostRemoved, postPublicUrlById } from '@/lib/seo-system/events-service';
import { trashPost } from '@/lib/seo-system/posts-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.delete');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const urlBefore = await postPublicUrlById(id);
  try {
    const result = await trashPost(id, auth!.userId, body.behavior || '410', body.redirect_target);
    await onPostRemoved(urlBefore, id, auth!.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'trash_failed', message: err.message },
      { status: 400 }
    );
  }
}
