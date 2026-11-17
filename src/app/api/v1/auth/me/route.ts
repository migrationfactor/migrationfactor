import { NextResponse } from 'next/server';
import { verifySeoSession } from '@/lib/seo-system/auth';

export async function GET() {
  const session = await verifySeoSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.display_name,
      roles: session.user.roles,
      permissions: session.user.permissions,
    },
    csrfToken: session.csrfToken,
  });
}
