import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPost } from '@/lib/seo-system/posts-service';
import { submitToIndexNow, DEFAULT_HOST } from '@/lib/seo-system/indexing-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'indexing.submit');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const url = `https://${DEFAULT_HOST}/blog/${post.slug}/`;
  const result = await submitToIndexNow([url], id, auth!.userId);

  return NextResponse.json(result);
}
