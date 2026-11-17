import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getActiveRobotsTxt } from '@/lib/seo-system/technical-seo';
import { testRobotsRule } from '@/lib/seo-system/workflow-service';

export async function POST(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  if (typeof body.path !== 'string' || !body.path.startsWith('/')) {
    return NextResponse.json({ error: 'invalid_path', message: 'Enter a URL path starting with /.' }, { status: 422 });
  }
  const content = typeof body.content === 'string' ? body.content : await getActiveRobotsTxt();
  return NextResponse.json(testRobotsRule(content, body.path, body.userAgent || 'Googlebot'));
}
