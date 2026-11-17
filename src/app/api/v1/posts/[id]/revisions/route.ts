import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listRevisions } from '@/lib/seo-system/workflow-service';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  return NextResponse.json(await listRevisions(id));
}
