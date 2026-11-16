import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { duplicatePost } from '@/lib/seo-system/posts-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.create');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const copy = await duplicatePost(id, auth!.userId);
    return NextResponse.json({ success: true, post: copy }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'duplicate_failed', message: err.message },
      { status: 400 }
    );
  }
}
