import { verifySeoSession } from '@/lib/seo-system/auth';
import { listCategories, listAuthors, listTags } from '@/lib/seo-system/taxonomies-service';
import PostEditor from '@/components/seo-admin/PostEditor';

export const dynamic = 'force-dynamic';

export default async function NewPostAdminPage() {
  const session = await verifySeoSession();
  const categories = await listCategories();
  const authors = await listAuthors();

  return (
    <PostEditor
      categories={categories}
      authors={authors}
      tags={await listTags()}
      currentUser={{ id: session?.user?.id, roles: (session?.user as any)?.roles || [] }}
    />
  );
}
