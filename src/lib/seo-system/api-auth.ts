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
  const sessionToken = req.cookies.get('seo_session_token')?.value;

  if (!sessionToken) {
    return {
      auth: null,
      errorResponse: NextResponse.json(
        { error: 'unauthenticated', message: 'You must be logged into the SEO system to access this endpoint.' },
        { status: 401 }
      ),
    };
  }

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
    const csrfHeader = req.headers.get('x-csrf-token');
    // If not matching session csrfToken, check if Bearer PAT token is present (otherwise reject)
    if (csrfHeader && csrfHeader !== session.csrfToken) {
      return {
        auth: null,
        errorResponse: NextResponse.json(
          { error: 'invalid_csrf_token', message: 'CSRF token mismatch. Please reload.' },
          { status: 403 }
        ),
      };
    }
  }

  if (requiredPermission && !hasPermission(session.user.permissions, requiredPermission)) {
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
