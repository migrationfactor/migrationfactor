import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listMedia, uploadMedia } from '@/lib/seo-system/media-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'media.upload');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const missingAlt = url.searchParams.get('missing_alt') === 'true';
  const search = url.searchParams.get('q') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const res = await listMedia({ missingAlt, search, limit, offset });
  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'media.upload');
  if (errorResponse) return errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'file_required', message: 'No file provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const altText = (formData.get('alt_text') as string) || '';
    const title = (formData.get('title') as string) || '';
    const caption = (formData.get('caption') as string) || '';
    const description = (formData.get('description') as string) || '';

    const media = await uploadMedia({
      filename: file.name,
      mimeType: file.type,
      buffer,
      altText,
      title,
      caption,
      description,
      actorId: auth!.userId,
    });

    return NextResponse.json(media, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'upload_failed', message: err.message }, { status: 422 });
  }
}
