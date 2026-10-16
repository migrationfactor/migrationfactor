import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/admin/auth';
import { newLeadCounts } from '@/lib/admin/queries';

/**
 * Sidebar counts for AdminNav. A plain GET rather than a server action, because the router waits
 * for a running server action before it navigates, which made sidebar clicks feel slow.
 */
export async function GET() {
  const [admin, counts] = await Promise.all([getAdmin(), newLeadCounts()]);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(counts, { headers: { 'Cache-Control': 'private, no-store' } });
}
