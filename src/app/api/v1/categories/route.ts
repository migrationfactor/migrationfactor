import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/seo-system/api-auth';
import { listCategories, createCategory, updateCategory, deleteCategory } from '@/lib/seo-system/taxonomies-service';

export async function GET(req: NextRequest) {
  const { errorResponse } = await authenticateApiRequest(req, 'taxonomy.manage');
  if (errorResponse) return errorResponse;

  const categories = await listCategories();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'taxonomy.manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const created = await createCategory(auth!.userId, body);
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'creation_failed', message: err.message }, { status: 422 });
  }
}

export async function PATCH(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'taxonomy.manage');
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { id, ...data } = body;
    const updated = await updateCategory(id, auth!.userId, data);
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: 'update_failed', message: err.message }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const { auth, errorResponse } = await authenticateApiRequest(req, 'taxonomy.manage');
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  try {
    await deleteCategory(id, auth!.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'delete_failed', message: err.message }, { status: 400 });
  }
}
