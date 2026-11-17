import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPost, updatePost, permanentDeletePost } from '@/lib/seo-system/posts-service';
import { canEditPost, hasPermission } from '@/lib/seo-system/rbac';

interface Context {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: Context) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const post = await getPost(id);

  if (!post) {
    return NextResponse.json({ error: 'not_found', message: 'Post not found.' }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PATCH(req: NextRequest, context: Context) {
  const { auth, errorResponse } = await authenticateApiRequest(req);
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const current = await getPost(id);
  if (!current) {
    return NextResponse.json({ error: 'not_found', message: 'Post not found.' }, { status: 404 });
  }

  // Authorization check (Section 18.1): post.edit (own) or post.edit_any
  if (!canEditPost(auth!.user, { created_by: current.created_by, status: current.status })) {
    return NextResponse.json(
      { error: 'forbidden', message: 'You can only edit your own posts.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    // Field-level authorization (Section 18.1)
    const roles = (auth!.user.roles || []) as any;
    if (!hasPermission(roles, 'seo.edit_advanced')) {
      const restricted = ['robotsIndex', 'robotsFollow', 'robotsAdvanced', 'canonicalUrl', 'sitemapInclude'];
      const touched = restricted.filter((k) => body[k] !== undefined);
      if (touched.length > 0) {
        return NextResponse.json(
          { error: 'forbidden', message: `Permission 'seo.edit_advanced' is required to change: ${touched.join(', ')}.` },
          { status: 403 }
        );
      }
    }
    if (!hasPermission(roles, 'schema.edit_custom') && (body.customJsonld !== undefined || body.disableAuto !== undefined || body.customMode !== undefined)) {
      return NextResponse.json(
        { error: 'forbidden', message: "Permission 'schema.edit_custom' is required to change custom schema." },
        { status: 403 }
      );
    }
    if (!hasPermission(roles, 'schema.edit') && (body.articleType !== undefined || body.faqEnabled !== undefined || body.howtoEnabled !== undefined)) {
      return NextResponse.json(
        { error: 'forbidden', message: "Permission 'schema.edit' is required to change schema options." },
        { status: 403 }
      );
    }
    const ifMatch = req.headers.get('if-match');
    const expectedVersion = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : body.version;

    const result = await updatePost(id, auth!.userId, body, expectedVersion, Boolean(body.minor_update));
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.status === 409) {
      return NextResponse.json(
        {
          error: 'conflict',
          message: err.message,
          current_version: err.currentVersion,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'validation_failed', message: err.message },
      { status: 422 }
    );
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.delete_permanent');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;

  try {
    const body = await req.json().catch(() => ({}));
    await permanentDeletePost(id, auth!.userId, body.confirm || '');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'deletion_failed', message: err.message },
      { status: 400 }
    );
  }
}
