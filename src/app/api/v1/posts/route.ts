import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listPosts, createDraft } from '@/lib/seo-system/posts-service';
import { refreshAnalysis } from '@/lib/seo-system/analysis-service';
import { hasPermission } from '@/lib/seo-system/rbac';

export async function GET(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || undefined;
  const categoryId = url.searchParams.get('category_id') || undefined;
  const tagId = url.searchParams.get('tag_id') || undefined;
  const authorId = url.searchParams.get('author_id') || undefined;
  const scoreBand = (url.searchParams.get('score_band') as any) || undefined;
  const missing = (url.searchParams.get('missing') as any) || undefined;
  const search = url.searchParams.get('q') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const sortBy = (url.searchParams.get('sort_by') as any) || 'created_at';
  const sortOrder = (url.searchParams.get('sort_order') as any) || 'desc';

  const result = await listPosts({
    status,
    categoryId,
    tagId,
    authorId,
    scoreBand,
    missing,
    search,
    limit,
    offset,
    sortBy,
    sortOrder,
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.create');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    if (!hasPermission((auth!.user.roles || []) as any, 'seo.edit_advanced')) {
      for (const key of ['robotsIndex', 'robotsFollow', 'robotsAdvanced', 'canonicalUrl', 'sitemapInclude', 'customJsonld', 'disableAuto', 'customMode']) {
        delete body[key];
      }
    }
    const post = await createDraft(auth!.userId, body);
    await refreshAnalysis((post as any).id).catch(() => undefined);
    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'validation_failed', message: err.message || 'Failed to create post.' },
      { status: 422 }
    );
  }
}
