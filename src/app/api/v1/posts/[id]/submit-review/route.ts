import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPost } from '@/lib/seo-system/posts-service';
import { canEditPost } from '@/lib/seo-system/rbac';
import { submitForReview } from '@/lib/seo-system/workflow-service';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.create');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!canEditPost(auth!.user, { created_by: post.created_by, status: post.status })) {
    return NextResponse.json({ error: 'forbidden', message: 'You can only submit your own drafts.' }, { status: 403 });
  }
  try {
    return NextResponse.json(await submitForReview(id, auth!.userId));
  } catch (err: any) {
    return NextResponse.json({ error: 'submit_failed', message: err.message }, { status: err.status || 422 });
  }
}
