import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { publishPost } from '@/lib/seo-system/posts-service';
import { notifyAfterChange } from '@/lib/seo-system/gsc-service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.publish');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  try {
    const result = await publishPost(id, auth!.userId, Boolean(body.acknowledge_warnings));
    await notifyAfterChange();
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.status === 409 || err.status === 422) {
      return NextResponse.json(
        {
          error: 'prepublish_checks_failed',
          message: err.message,
          blocking: err.blocking || [],
          warnings: err.warnings || [],
          can_publish_with_ack: err.canPublishWithAck || false,
        },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { error: 'publish_failed', message: err.message },
      { status: 500 }
    );
  }
}
