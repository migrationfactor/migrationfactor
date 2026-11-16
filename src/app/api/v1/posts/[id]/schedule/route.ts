import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { schedulePost } from '@/lib/seo-system/posts-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.publish');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  if (!body.publish_at) {
    return NextResponse.json(
      { error: 'validation_failed', message: 'publish_at ISO timestamp is required.' },
      { status: 422 }
    );
  }

  try {
    const result = await schedulePost(id, auth!.userId, body.publish_at);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'schedule_failed', message: err.message },
      { status: 400 }
    );
  }
}
