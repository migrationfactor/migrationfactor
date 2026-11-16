import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { unpublishPost } from '@/lib/seo-system/posts-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.publish');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await unpublishPost(id, auth!.userId, body.behavior || '404', body.redirect_target);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'unpublish_failed', message: err.message },
      { status: 400 }
    );
  }
}
