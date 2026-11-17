import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPostLinks, suggestLinks } from '@/lib/seo-system/link-service';

// Incoming/outgoing links and ranked suggestions for the editor Links tab (FR-LNK-002/004).
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  const [links, suggestions] = await Promise.all([getPostLinks(id), suggestLinks(id)]);
  return NextResponse.json({ ...links, suggestions });
}
