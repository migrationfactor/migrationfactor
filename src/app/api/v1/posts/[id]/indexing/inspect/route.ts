import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { inspectPost } from '@/lib/seo-system/gsc-service';

// "Check now": reads Google's real index status for the post (rate-limited to once per 10 minutes).
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'indexing.submit');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  try {
    return NextResponse.json(await inspectPost(id, auth!.userId));
  } catch (err: any) {
    return NextResponse.json({ error: 'gsc_error', message: err.message }, { status: err.status || 502 });
  }
}
