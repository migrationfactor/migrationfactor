import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { rebuildAllLinks, checkExternalLinks } from '@/lib/seo-system/link-service';
import { logAudit } from '@/lib/seo-system/audit';

// Maintenance: rebuild the link graph from every post, optionally check some external links now.
export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'sitemaps.manage');
  if (errorResponse) return errorResponse;
  const body = await req.json().catch(() => ({}));
  const rebuilt = await rebuildAllLinks();
  const checked = body.check ? await checkExternalLinks(40) : null;
  await logAudit({ actorId: auth!.userId, action: 'links.rebuild', entityType: 'links', afterState: { ...rebuilt, checked } });
  return NextResponse.json({ rebuilt, checked });
}
