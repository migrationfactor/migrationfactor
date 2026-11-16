import { NextRequest, NextResponse } from 'next/server';
import { authenticateSeoUser, createSeoSession } from '@/lib/seo-system/auth';
import { logAudit } from '@/lib/seo-system/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'validation_failed', message: 'Email and password are required.' },
        { status: 422 }
      );
    }

    const user = await authenticateSeoUser(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'invalid_credentials', message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const { sessionToken, csrfToken } = await createSeoSession(user.id, ipAddress, userAgent);

    await logAudit({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      afterState: { email: user.email, ip: ipAddress },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        roles: user.roles,
        permissions: user.permissions,
      },
      csrfToken,
    });

    // Set secure HTTP-only session cookie
    response.cookies.set('seo_session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: 'server_error', message: err.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
