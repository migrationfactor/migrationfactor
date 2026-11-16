import { listCategories, listAuthors } from '@/lib/seo-system/taxonomies-service';
import PostEditor from '@/components/seo-admin/PostEditor';

export const dynamic = 'force-dynamic';

export default async function NewPostAdminPage() {
  const categories = await listCategories();
  const authors = await listAuthors();

  return (
    <PostEditor
      categories={categories}
      authors={authors}
      currentUser={{}}
    />
  );
}
