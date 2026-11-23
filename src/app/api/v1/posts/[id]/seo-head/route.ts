import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { getPost } from '@/lib/seo-system/posts-service';
import { validateSchemaGraph } from '@/lib/seo-system/schema-service';
import { renderSeoHead } from '@/lib/seo-system/head-service';
import { SITE_URL } from '@/lib/seo-system/technical-seo';
import { getSeoSettings } from '@/lib/seo-system/settings-service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'post.read');
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const post = await getPost(id);

  if (!post) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const result = renderSeoHead({
    siteUrl: SITE_URL,
    siteName: (await getSeoSettings()).siteName,
    post,
    seo: post.seo,
    social: post.social,
    schemaConfig: post.schema,
    geoAeo: post.geo_aeo,
    featuredMedia: post.featured_media_url ? {
      url: post.featured_media_url,
      alt: post.featured_alt_override || post.featured_media_alt,
      width: post.featured_media_width,
      height: post.featured_media_height,
      caption: post.featured_caption_override || post.featured_media_caption,
    } : undefined,
    category: post.categories?.[0],
    authors: post.authors,
  });

  let schemaValidation: any = { errors: [], warnings: [] };
  try { schemaValidation = validateSchemaGraph((result as any).schemaGraph); } catch { /* keep empty */ }
  return NextResponse.json({ ...result, schemaValidation });
}
