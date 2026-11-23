import { verifySeoSession } from '@/lib/seo-system/auth';
import { notFound } from 'next/navigation';
import { getPost } from '@/lib/seo-system/posts-service';
import { listCategories, listAuthors, listTags } from '@/lib/seo-system/taxonomies-service';
import PostEditor from '@/components/seo-admin/PostEditor';
import { getSeoSettings } from '@/lib/seo-system/settings-service';
import { queryOne } from '@/lib/seo-system/db';

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
      brokenLinks={parseInt((await queryOne<{ n: string }>('SELECT count(*) AS n FROM public.seo_links WHERE source_post_id = $1 AND last_status >= 400', [id]))?.n || '0', 10)}
      site={await getSeoSettings().then((st) => ({ name: st.siteName, titleTemplate: st.titleTemplate, titleSeparator: st.titleSeparator }))}
      tags={await listTags()}
      currentUser={{ id: session?.user?.id, roles: (session?.user as any)?.roles || [] }}
    />
  );
}
