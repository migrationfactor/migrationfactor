import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { restorePost } from '@/lib/seo-system/posts-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.delete');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const result = await restorePost(id, auth!.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'restore_failed', message: err.message },
      { status: 400 }
    );
  }
}
