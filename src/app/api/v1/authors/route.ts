import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listAuthors, createAuthor, updateAuthor } from '@/lib/seo-system/taxonomies-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'authors.manage');
  if (errorResponse) return errorResponse;

  const authors = await listAuthors();
  return NextResponse.json(authors);
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'authors.manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const created = await createAuthor(auth!.userId, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'creation_failed', message: err.message }, { status: 422 });
  }
}

export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'authors.manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { id, ...data } = body;
    const updated = await updateAuthor(id, auth!.userId, data);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: 'update_failed', message: err.message }, { status: 422 });
  }
}
