import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { retryFailedSubmissions } from '@/lib/seo-system/indexing-service';

/** Manual "Retry failed submissions" (FR-IDX-006). The daily cron runs the same job. */
export async function POST(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'indexing.submit');
  if (errorResponse) return errorResponse;
  return NextResponse.json(await retryFailedSubmissions());
}
