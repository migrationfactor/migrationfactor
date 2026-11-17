import { verifySeoSession } from '@/lib/seo-system/auth';
import { notFound } from 'next/navigation';
import { getPost } from '@/lib/seo-system/posts-service';
import { listCategories, listAuthors, listTags } from '@/lib/seo-system/taxonomies-service';
import PostEditor from '@/components/seo-admin/PostEditor';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPostAdminPage(props: Props) {
  const { id } = await props.params;

  const post = await getPost(id);
  if (!post) notFound();

  const session = await verifySeoSession();
  const categories = await listCategories();
  const authors = await listAuthors();

  return (
    <PostEditor
      initialPost={post}
      categories={categories}
      authors={authors}
      tags={await listTags()}
      currentUser={{ id: session?.user?.id, roles: (session?.user as any)?.roles || [] }}
    />
  );
}
