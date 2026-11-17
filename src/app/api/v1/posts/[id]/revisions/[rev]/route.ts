import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getRevision } from '@/lib/seo-system/workflow-service';

// Returns the snapshot and an editor payload. Nothing is saved or published (FR-BLG-011).
export async function GET(req: NextRequest, context: { params: Promise<{ id: string; rev: string }> }) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const { id, rev } = await context.params;
  const revisionNo = parseInt(rev, 10);
  if (!Number.isFinite(revisionNo)) return NextResponse.json({ error: 'invalid_revision' }, { status: 400 });
  const revision = await getRevision(id, revisionNo);
  if (!revision) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(revision);
}
