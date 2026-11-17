import { NextRequest, NextResponse } from 'next/server';
import { verifySeoSession } from './auth';
import { hasPermission } from './rbac';

export interface AuthContext {
  userId: string;
  user: any;
  permissions: string[];
  roles: string[];
  csrfToken: string;
}

/**
 * Validates request authentication and permission
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredPermission?: string
): Promise<{ auth: AuthContext | null; errorResponse: NextResponse | null }> {
  // Single sign-on: the session is the main admin (Supabase) login.
  const sessionToken = undefined;

  const session = await verifySeoSession(sessionToken);
  if (!session) {
    return {
      auth: null,
      errorResponse: NextResponse.json(
        { error: 'unauthenticated', message: 'Session expired. Please log in again.' },
        { status: 401 }
      ),
    };
  }

  // Validate CSRF token on state-changing methods (POST, PUT, PATCH, DELETE)
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    // SEC-03: a request must be same-origin (Origin header matches host) or carry the
    // session's synchronizer token. A missing header alone no longer passes.
    const csrfHeader = req.headers.get('x-csrf-token');
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    let sameOrigin = false;
    if (origin && host) {
      try {
        sameOrigin = new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
    }
    const tokenValid = Boolean(csrfHeader) && csrfHeader === session.csrfToken;
    if (!tokenValid && !sameOrigin) {
      return {
        auth: null,
        errorResponse: NextResponse.json(
          { error: 'invalid_csrf_token', message: 'Cross-site request rejected. Reload the page and try again.' },
          { status: 403 }
        ),
      };
    }
  }

  if (
    requiredPermission &&
    !session.user.permissions?.includes(requiredPermission) &&
    !hasPermission((session.user.roles || []) as any, requiredPermission)
  ) {
    return {
      auth: null,
      errorResponse: NextResponse.json(
        {
          error: 'forbidden',
          message: `Permission '${requiredPermission}' is required for this action.`,
        },
        { status: 403 }
      ),
    };
  }

  return {
    auth: {
      userId: session.user.id,
      user: session.user,
      permissions: session.user.permissions,
      roles: session.user.roles,
      csrfToken: session.csrfToken,
    },
    errorResponse: null,
  };
}
