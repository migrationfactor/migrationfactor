import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { latestVerification, verifyLivePage } from '@/lib/seo-system/verify-service';
import { query } from '@/lib/seo-system/db';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  return NextResponse.json((await latestVerification(id)) || null);
}

/** "Verify live page now": compares the live HTML with the saved SEO settings (Section 17.4). */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;
  const { id } = await context.params;
  const result = await verifyLivePage(id);
  await query(
    `INSERT INTO public.seo_scheduled_jobs (event_type, aggregate_id, payload, status, last_error)
     VALUES ('post.verify_live', $1, $2, $3, $4)`,
    [id, JSON.stringify(result), result.ok ? 'done' : 'failed', result.ok ? null : result.problems.join(' | ').slice(0, 1000)]
  );
  return NextResponse.json(result);
}
