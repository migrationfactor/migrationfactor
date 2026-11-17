import { query, queryOne, withTransaction } from './db';
import { logAudit } from './audit';
import { generateSlug } from './posts-service';

export interface CategoryInput {
  name: string;
  slug?: string;
  parentId?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  ogImageMediaId?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
}

export interface TagInput {
  name: string;
  slug?: string;
  description?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
}

export interface AuthorInput {
  userId?: string | null;
  displayName: string;
  slug?: string;
  jobTitle?: string | null;
  shortBio?: string | null;
  longBio?: string | null;
  avatarUrl?: string | null;
  emailPublic?: string | null;
  sameAs?: string[];
  credentials?: Array<{ name: string; issuingBody: string; year?: number; verificationUrl?: string }>;
  areasOfExpertise?: string[];
  isExpertReviewer?: boolean;
}

// -----------------------------------------------------------------------------
// Categories (FR-TAX-001)
// -----------------------------------------------------------------------------

export async function listCategories() {
  return await query<any>(
    `SELECT c.*, 
            p.name as parent_name,
            (SELECT count(*) FROM public.seo_post_categories pc JOIN public.seo_posts po ON po.id = pc.post_id WHERE pc.category_id = c.id AND po.status = 'published') as post_count
     FROM public.seo_categories c
     LEFT JOIN public.seo_categories p ON p.id = c.parent_id
     ORDER BY c.name ASC`
  );
}

export async function getCategory(idOrSlug: string) {
  return await queryOne<any>(
    `SELECT c.*, 
            p.name as parent_name,
            (SELECT count(*) FROM public.seo_post_categories pc JOIN public.seo_posts po ON po.id = pc.post_id WHERE pc.category_id = c.id AND po.status = 'published') as post_count
     FROM public.seo_categories c
     LEFT JOIN public.seo_categories p ON p.id = c.parent_id
     WHERE c.id::text = $1 OR c.slug = $1`,
    [idOrSlug]
  );
}

export async function createCategory(actorId: string, input: CategoryInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Category name is required.');
  }

  const slug = input.slug || generateSlug(input.name);

  // Check unique slug
  const existing = await queryOne(`SELECT id FROM public.seo_categories WHERE slug = $1`, [slug]);
  if (existing) {
    throw new Error(`Category slug '${slug}' is already taken.`);
  }

  const res = await queryOne<any>(
    `INSERT INTO public.seo_categories (
      name, slug, parent_id, description, seo_title, meta_description,
      canonical_url, og_image_media_id, robots_index
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      input.name.trim(),
      slug,
      input.parentId || null,
      input.description || null,
      input.seoTitle || null,
      input.metaDescription || null,
      input.canonicalUrl || null,
      input.ogImageMediaId || null,
      input.robotsIndex !== false,
    ]
  );

  await logAudit({
    actorId,
    action: 'category.create',
    entityType: 'category',
    entityId: res.id,
    afterState: res,
  });

  return res;
}

export async function updateCategory(id: string, actorId: string, input: Partial<CategoryInput>) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_categories WHERE id = $1`, [id]);
  if (!current) throw new Error('Category not found');

  let newSlug = current.slug;
  if (input.slug && input.slug !== current.slug) {
    const existing = await queryOne(`SELECT id FROM public.seo_categories WHERE slug = $1 AND id <> $2`, [input.slug, id]);
    if (existing) throw new Error(`Category slug '${input.slug}' is already taken.`);
    newSlug = input.slug;

    // Create 301 redirect from old archive to new archive
    await query(
      `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
       VALUES ($1, $2, 301, $3, 'Category slug update')
       ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
      [`/blog/category/${current.slug}`, `/blog/category/${newSlug}`, actorId]
    );
  }

  const res = await queryOne<any>(
    `UPDATE public.seo_categories SET
      name = COALESCE($1, name),
      slug = $2,
      parent_id = $3,
      description = $4,
      seo_title = $5,
      meta_description = $6,
      canonical_url = $7,
      og_image_media_id = $8,
      robots_index = COALESCE($9, robots_index),
      updated_at = now()
    WHERE id = $10
    RETURNING *`,
    [
      input.name !== undefined ? input.name.trim() : null,
      newSlug,
      input.parentId !== undefined ? input.parentId : current.parent_id,
      input.description !== undefined ? input.description : current.description,
      input.seoTitle !== undefined ? input.seoTitle : current.seo_title,
      input.metaDescription !== undefined ? input.metaDescription : current.meta_description,
      input.canonicalUrl !== undefined ? input.canonicalUrl : current.canonical_url,
      input.ogImageMediaId !== undefined ? input.ogImageMediaId : current.og_image_media_id,
      input.robotsIndex !== undefined ? input.robotsIndex : null,
      id,
    ]
  );

  await logAudit({
    actorId,
    action: 'category.update',
    entityType: 'category',
    entityId: id,
    beforeState: current,
    afterState: res,
  });

  return res;
}

export async function deleteCategory(id: string, actorId: string, fallbackCategoryId?: string) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_categories WHERE id = $1`, [id]);
  if (!current) throw new Error('Category not found');

  return await withTransaction(async (client) => {
    // Reassign posts or default to null
    if (fallbackCategoryId) {
      await client.query(
        `UPDATE public.seo_posts SET primary_category_id = $1 WHERE primary_category_id = $2`,
        [fallbackCategoryId, id]
      );
      await client.query(
        `UPDATE public.seo_post_categories SET category_id = $1 WHERE category_id = $2`,
        [fallbackCategoryId, id]
      );
    } else {
      await client.query(
        `UPDATE public.seo_posts SET primary_category_id = NULL WHERE primary_category_id = $1`,
        [id]
      );
      await client.query(
        `DELETE FROM public.seo_post_categories WHERE category_id = $1`,
        [id]
      );
    }

    // Create 301 redirect
    const fallbackSlug = fallbackCategoryId
      ? (await client.query(`SELECT slug FROM public.seo_categories WHERE id = $1`, [fallbackCategoryId])).rows[0]?.slug
      : null;
    const targetUrl = fallbackSlug ? `/blog/category/${fallbackSlug}` : '/blog';
    await client.query(
      `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
       VALUES ($1, $2, 301, $3, 'Category deletion redirect')
       ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
      [`/blog/category/${current.slug}`, targetUrl, actorId]
    );

    await client.query(`DELETE FROM public.seo_categories WHERE id = $1`, [id]);

    await logAudit({
      actorId,
      action: 'category.delete',
      entityType: 'category',
      entityId: id,
      beforeState: current,
    });

    return { success: true };
  });
}

// -----------------------------------------------------------------------------
// Tags (FR-TAX-002)
// -----------------------------------------------------------------------------

export async function listTags() {
  return await query<any>(
    `SELECT t.*, 
            (SELECT count(*) FROM public.seo_post_tags pt JOIN public.seo_posts po ON po.id = pt.post_id WHERE pt.tag_id = t.id AND po.status = 'published') as post_count
     FROM public.seo_tags t
     ORDER BY t.name ASC`
  );
}

export async function getTag(idOrSlug: string) {
  return await queryOne<any>(
    `SELECT t.*, 
            (SELECT count(*) FROM public.seo_post_tags pt JOIN public.seo_posts po ON po.id = pt.post_id WHERE pt.tag_id = t.id AND po.status = 'published') as post_count
     FROM public.seo_tags t
     WHERE t.id::text = $1 OR t.slug = $1`,
    [idOrSlug]
  );
}

export async function createTag(actorId: string, input: TagInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Tag name is required.');
  }

  const slug = input.slug || generateSlug(input.name);

  // Check unique slug
  const existing = await queryOne(`SELECT id FROM public.seo_tags WHERE slug = $1`, [slug]);
  if (existing) {
    throw new Error(`Tag slug '${slug}' is already taken.`);
  }

  const res = await queryOne<any>(
    `INSERT INTO public.seo_tags (
      name, slug, description, seo_title, meta_description, robots_index
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      input.name.trim(),
      slug,
      input.description || null,
      input.seoTitle || null,
      input.metaDescription || null,
      input.robotsIndex !== undefined ? input.robotsIndex : true,
    ]
  );

  await logAudit({
    actorId,
    action: 'tag.create',
    entityType: 'tag',
    entityId: res.id,
    afterState: res,
  });

  return res;
}

export async function updateTag(id: string, actorId: string, input: Partial<TagInput>) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_tags WHERE id = $1`, [id]);
  if (!current) throw new Error('Tag not found');

  let newSlug = current.slug;
  if (input.slug && input.slug !== current.slug) {
    const existing = await queryOne(`SELECT id FROM public.seo_tags WHERE slug = $1 AND id <> $2`, [input.slug, id]);
    if (existing) throw new Error(`Tag slug '${input.slug}' is already taken.`);
    newSlug = input.slug;

    await query(
      `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
       VALUES ($1, $2, 301, $3, 'Tag slug update')
       ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
      [`/blog/tag/${current.slug}`, `/blog/tag/${newSlug}`, actorId]
    );
  }

  const res = await queryOne<any>(
    `UPDATE public.seo_tags SET
      name = COALESCE($1, name),
      slug = $2,
      description = $3,
      seo_title = $4,
      meta_description = $5,
      robots_index = COALESCE($6, robots_index),
      updated_at = now()
    WHERE id = $7
    RETURNING *`,
    [
      input.name !== undefined ? input.name.trim() : null,
      newSlug,
      input.description !== undefined ? input.description : current.description,
      input.seoTitle !== undefined ? input.seoTitle : current.seo_title,
      input.metaDescription !== undefined ? input.metaDescription : current.meta_description,
      input.robotsIndex !== undefined ? input.robotsIndex : null,
      id,
    ]
  );

  await logAudit({
    actorId,
    action: 'tag.update',
    entityType: 'tag',
    entityId: id,
    beforeState: current,
    afterState: res,
  });

  return res;
}

export async function deleteTag(id: string, actorId: string) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_tags WHERE id = $1`, [id]);
  if (!current) throw new Error('Tag not found');

  await query(`DELETE FROM public.seo_tags WHERE id = $1`, [id]);

  await logAudit({
    actorId,
    action: 'tag.delete',
    entityType: 'tag',
    entityId: id,
    beforeState: current,
  });

  return { success: true };
}

// -----------------------------------------------------------------------------
// Authors (FR-TAX-003)
// -----------------------------------------------------------------------------

export async function listAuthors() {
  return await query<any>(
    `SELECT a.*, 
            (SELECT count(*) FROM public.seo_post_authors pa JOIN public.seo_posts po ON po.id = pa.post_id WHERE pa.author_id = a.id AND po.status = 'published') as post_count
     FROM public.seo_authors a
     ORDER BY a.display_name ASC`
  );
}

export async function getAuthor(idOrSlug: string) {
  return await queryOne<any>(
    `SELECT a.*, 
            (SELECT count(*) FROM public.seo_post_authors pa JOIN public.seo_posts po ON po.id = pa.post_id WHERE pa.author_id = a.id AND po.status = 'published') as post_count
     FROM public.seo_authors a
     WHERE a.id::text = $1 OR a.slug = $1`,
    [idOrSlug]
  );
}

export async function createAuthor(actorId: string, input: AuthorInput) {
  if (!input.displayName || input.displayName.trim().length === 0) {
    throw new Error('Author display name is required.');
  }

  const slug = input.slug || generateSlug(input.displayName);

  const existing = await queryOne(`SELECT id FROM public.seo_authors WHERE slug = $1`, [slug]);
  if (existing) {
    throw new Error(`Author slug '${slug}' is already taken.`);
  }

  const res = await queryOne<any>(
    `INSERT INTO public.seo_authors (
      user_id, display_name, slug, job_title, bio_short, bio_long,
      email, same_as, credentials, expertise, is_reviewer
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.userId || null,
      input.displayName.trim(),
      slug,
      input.jobTitle || null,
      input.shortBio || null,
      input.longBio || null,
      input.emailPublic || null,
      JSON.stringify(input.sameAs || []),
      JSON.stringify(input.credentials || []),
      JSON.stringify(input.areasOfExpertise || []),
      input.isExpertReviewer || false,
    ]
  );

  await logAudit({
    actorId,
    action: 'author.create',
    entityType: 'author',
    entityId: res.id,
    afterState: res,
  });

  return res;
}

export async function updateAuthor(id: string, actorId: string, input: Partial<AuthorInput>) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_authors WHERE id = $1`, [id]);
  if (!current) throw new Error('Author not found');

  let newSlug = current.slug;
  if (input.slug && input.slug !== current.slug) {
    const existing = await queryOne(`SELECT id FROM public.seo_authors WHERE slug = $1 AND id <> $2`, [input.slug, id]);
    if (existing) throw new Error(`Author slug '${input.slug}' is already taken.`);
    newSlug = input.slug;

    await query(
      `INSERT INTO public.seo_redirects (source_path, target_url, http_code, created_by, notes)
       VALUES ($1, $2, 301, $3, 'Author slug update')
       ON CONFLICT (source_path) DO UPDATE SET target_url = EXCLUDED.target_url`,
      [`/blog/author/${current.slug}`, `/blog/author/${newSlug}`, actorId]
    );
  }

  const res = await queryOne<any>(
    `UPDATE public.seo_authors SET
      user_id = COALESCE($1, user_id),
      display_name = COALESCE($2, display_name),
      slug = $3,
      job_title = $4,
      bio_short = $5,
      bio_long = $6,
      email = $7,
      same_as = COALESCE($8, same_as),
      credentials = COALESCE($9, credentials),
      expertise = COALESCE($10, expertise),
      is_reviewer = COALESCE($11, is_reviewer),
      updated_at = now()
    WHERE id = $12
    RETURNING *`,
    [
      input.userId !== undefined ? input.userId : null,
      input.displayName !== undefined ? input.displayName.trim() : null,
      newSlug,
      input.jobTitle !== undefined ? input.jobTitle : current.job_title,
      input.shortBio !== undefined ? input.shortBio : current.bio_short,
      input.longBio !== undefined ? input.longBio : current.bio_long,
      input.emailPublic !== undefined ? input.emailPublic : current.email,
      input.sameAs ? JSON.stringify(input.sameAs) : null,
      input.credentials ? JSON.stringify(input.credentials) : null,
      input.areasOfExpertise ? JSON.stringify(input.areasOfExpertise) : null,
      input.isExpertReviewer !== undefined ? input.isExpertReviewer : null,
      id,
    ]
  );

  await logAudit({
    actorId,
    action: 'author.update',
    entityType: 'author',
    entityId: id,
    beforeState: current,
    afterState: res,
  });

  return res;
}
