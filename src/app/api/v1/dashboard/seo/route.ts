import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getSeoDashboardData } from '@/lib/seo-system/dashboard-service';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'seo.reports');
  if (errorResponse) return errorResponse;

  const data = await getSeoDashboardData();
  return NextResponse.json(data);
}
