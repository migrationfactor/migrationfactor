import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listAuditLogs } from '@/lib/seo-system/workflow-service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'audit.read');
  if (errorResponse) return errorResponse;
  const p = new URL(req.url).searchParams;
  const roles: string[] = auth!.user.roles || [];
  const seesAll = roles.includes('super_admin') || roles.includes('admin');
  return NextResponse.json(
    await listAuditLogs({
      entityType: p.get('entity_type') || undefined,
      // SEO Managers see only their own actions (Section 18.1)
      actorId: seesAll ? p.get('actor_id') || undefined : auth!.userId,
      action: p.get('action') || undefined,
      limit: Number(p.get('limit')) || 50,
      offset: Number(p.get('offset')) || 0,
    })
  );
}
