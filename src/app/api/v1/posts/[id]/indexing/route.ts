import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPostIndexingStatus } from '@/lib/seo-system/indexing-service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  try {
    const status = await getPostIndexingStatus(id);
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: 'not_found', message: err.message }, { status: 404 });
  }
}
