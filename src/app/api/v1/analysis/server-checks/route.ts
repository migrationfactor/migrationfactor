import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { query, queryOne } from '@/lib/seo-system/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const {
    postId,
    slug,
    focusKeyword,
    metaDescription,
    canonicalUrl,
    robotsIndex,
    sitemapInclude,
  } = body;

  const errors: Array<{ field: string; code: string; message: string }> = [];
  const warnings: Array<{ field: string; code: string; message: string }> = [];

  // 1. Slug taken check (FR-SEO-005)
  if (slug) {
    const existingSlug = await queryOne<{ id: string; title: string }>(
      `SELECT id, title FROM public.seo_posts WHERE slug = $1 AND status <> 'trashed' ${postId ? 'AND id <> $2' : ''} LIMIT 1`,
      postId ? [slug, postId] : [slug]
    );
    if (existingSlug) {
      errors.push({
        field: 'slug',
        code: 'slug_taken',
        message: `This URL slug is already used by '${existingSlug.title}'.`,
      });
    }
  }

  // 2. Focus keyword cannibalization (FR-SEO-000)
  if (focusKeyword && focusKeyword.trim().length > 0) {
    const kwNorm = focusKeyword.trim().toLowerCase();
    const existingKw = await query<any>(
      `SELECT p.id, p.title, p.slug
       FROM public.seo_post_seo s
       JOIN public.seo_posts p ON p.id = s.post_id
       WHERE lower(s.focus_keyword) = $1 AND p.status = 'published' ${postId ? 'AND p.id <> $2' : ''}
       LIMIT 3`,
      postId ? [kwNorm, postId] : [kwNorm]
    );

    if (existingKw.length > 0) {
      warnings.push({
        field: 'focusKeyword',
        code: 'keyword_cannibalization',
        message: `Focus keyword '${focusKeyword}' is already targeted by ${existingKw.length} published post(s): ${existingKw.map(p => `'${p.title}'`).join(', ')}.`,
      });
    }
  }

  // 3. Meta description duplicate check (FR-SEO-002)
  if (metaDescription && metaDescription.trim().length > 0) {
    const hash = crypto.createHash('sha256').update(metaDescription.trim().toLowerCase()).digest('hex');
    const existingDesc = await queryOne<any>(
      `SELECT p.title FROM public.seo_post_seo s
       JOIN public.seo_posts p ON p.id = s.post_id
       WHERE s.meta_description_hash = $1 AND p.status = 'published' ${postId ? 'AND p.id <> $2' : ''} LIMIT 1`,
      postId ? [hash, postId] : [hash]
    );
    if (existingDesc) {
      warnings.push({
        field: 'metaDescription',
        code: 'meta_description_duplicate',
        message: `Meta description is identical to '${existingDesc.title}'. Unique descriptions perform better in search.`,
      });
    }
  }

  // 4. Canonical target check (FR-SEO-004)
  if (canonicalUrl && canonicalUrl.trim().length > 0) {
    if (canonicalUrl.startsWith('javascript:') || canonicalUrl.startsWith('data:')) {
      errors.push({
        field: 'canonicalUrl',
        code: 'invalid_scheme',
        message: 'Invalid canonical URL scheme.',
      });
    }
  }

  // 5. Robots vs sitemap conflict (FR-TEC-002)
  if (robotsIndex === false && sitemapInclude === true) {
    warnings.push({
      field: 'robotsIndex',
      code: 'noindex_in_sitemap',
      message: 'This post is set to noindex but is marked for sitemap inclusion. It will be excluded from the sitemap automatically.',
    });
  }

  return NextResponse.json({
    valid: errors.length === 0,
    errors,
    warnings,
  });
}
