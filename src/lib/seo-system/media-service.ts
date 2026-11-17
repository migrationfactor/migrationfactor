if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}

import path from 'path';
import fs from 'fs/promises';
import { query, queryOne, withTransaction } from './db';
import { logAudit } from './audit';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface MediaUploadInput {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  altText?: string;
  title?: string;
  caption?: string;
  description?: string;
  credit?: string;
  license?: string;
  focusX?: number;
  focusY?: number;
  actorId: string;
}

export interface MediaUpdateInput {
  altText?: string;
  title?: string;
  caption?: string;
  description?: string;
  credit?: string;
  license?: string;
  focusX?: number;
  focusY?: number;
}

function normalizeMediaRow(m: any) {
  if (!m) return null;
  const storagePath = m.storage_path || '';
  const url = storagePath.startsWith('/') ? storagePath : `/${storagePath}`;
  return {
    ...m,
    url,
    storage_key: storagePath,
    alt_text: m.alt || '',
    file_size: m.size_bytes || 0,
  };
}

/**
 * Lists media items with pagination and filters
 */
export async function listMedia(filters: { missingAlt?: boolean; search?: string; limit?: number; offset?: number } = {}) {
  const { missingAlt, search, limit = 50, offset = 0 } = filters;
  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (missingAlt) {
    whereClauses.push(`(m.alt IS NULL OR trim(m.alt) = '')`);
  }

  if (search) {
    whereClauses.push(`(m.title ILIKE $${paramIdx} OR m.filename ILIKE $${paramIdx} OR m.alt ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await queryOne<{ count: string }>(
    `SELECT count(*) as count FROM public.seo_media m ${whereSql}`,
    params
  );
  const total = parseInt(countRes?.count || '0', 10);

  const mediaList = await query<any>(
    `SELECT m.*, 
            u.name as uploaded_by_name,
            (SELECT count(*) FROM public.seo_media_usage u WHERE u.media_id = m.id) as usage_count
     FROM public.seo_media m
     LEFT JOIN public.seo_users u ON u.id = m.uploaded_by
     ${whereSql}
     ORDER BY m.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { media: mediaList.map(normalizeMediaRow), total, limit, offset };
}

/**
 * Get media by ID with usage details
 */
export async function getMedia(id: string) {
  const item = await queryOne<any>(
    `SELECT m.*, u.name as uploaded_by_name
     FROM public.seo_media m
     LEFT JOIN public.seo_users u ON u.id = m.uploaded_by
     WHERE m.id = $1`,
    [id]
  );

  if (!item) return null;

  const usage = await query<any>(
    `SELECT u.field as field_name, u.created_at, p.id as post_id, p.title as post_title, p.slug as post_slug
     FROM public.seo_media_usage u
     JOIN public.seo_posts p ON p.id = u.entity_id AND u.entity_type = 'post'
     WHERE u.media_id = $1`,
    [id]
  );

  const variants = await query<any>(
    `SELECT * FROM public.seo_media_variants WHERE media_id = $1`,
    [id]
  );

  return { ...normalizeMediaRow(item), usage, variants };
}

/**
 * Upload and register a new media item (FR-MED-001, SEC-06)
 */
export async function uploadMedia(input: MediaUploadInput) {
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new Error(`Disallowed media type '${input.mimeType}'. Accepted formats: JPEG, PNG, WebP, AVIF.`);
  }

  if (input.buffer.length > 15 * 1024 * 1024) {
    throw new Error('File exceeds maximum upload size of 15 MB.');
  }

  // Generate safe filename and public storage path
  const sanitizedFilename = input.filename
    .toLowerCase()
    .replace(/[^\w.-]/g, '-')
    .replace(/--+/g, '-');

  const now = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const storageDir = path.join(process.cwd(), 'public', 'uploads', 'blog', yearMonth);
  await fs.mkdir(storageDir, { recursive: true });

  const uniqueSuffix = Date.now().toString(36);
  const ext = path.extname(sanitizedFilename) || '.jpg';
  const baseName = path.basename(sanitizedFilename, ext);
  const finalFilename = `${baseName}-${uniqueSuffix}${ext}`;
  const filePath = path.join(storageDir, finalFilename);

  // Write file to public/uploads/blog/YYYY/MM
  await fs.writeFile(filePath, input.buffer);

  const publicUrl = `/uploads/blog/${yearMonth}/${finalFilename}`;

  // Default width/height (standard 1200x800 if not extracted via sharp)
  const width = 1200;
  const height = 800;

  const title = input.title || baseName.replace(/-/g, ' ');
  const alt = input.altText || '';

  const media = await queryOne<any>(
    `INSERT INTO public.seo_media (
      filename, storage_path, mime_type, size_bytes, width, height,
      alt, title, caption, description, credit, license,
      focus_x, focus_y, uploaded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
    [
      finalFilename,
      publicUrl,
      input.mimeType,
      input.buffer.length,
      width,
      height,
      alt,
      title,
      input.caption || null,
      input.description || null,
      input.credit || null,
      input.license || null,
      input.focusX !== undefined ? input.focusX : 50,
      input.focusY !== undefined ? input.focusY : 50,
      input.actorId,
    ]
  );

  // Register social and schema crops (FR-MED-001)
  const variants = [
    { purpose: 'social_og', width: 1200, height: 630 },
    { purpose: 'social_x', width: 1200, height: 600 },
    { purpose: 'schema_16_9', width: 1200, height: 675 },
    { purpose: 'schema_4_3', width: 1200, height: 900 },
    { purpose: 'schema_1_1', width: 800, height: 800 },
  ];

  for (const v of variants) {
    await query(
      `INSERT INTO public.seo_media_variants (
        media_id, purpose, storage_path, width, height, format, size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [media.id, v.purpose, publicUrl, v.width, v.height, input.mimeType.replace('image/', ''), input.buffer.length]
    );
  }

  await logAudit({
    actorId: input.actorId,
    action: 'media.upload',
    entityType: 'media',
    entityId: media.id,
    afterState: { filename: finalFilename, url: publicUrl, size: input.buffer.length },
  });

  return normalizeMediaRow(media);
}

/**
 * Update media SEO fields (alt text, caption, description, focus point)
 */
export async function updateMedia(id: string, actorId: string, input: MediaUpdateInput) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_media WHERE id = $1`, [id]);
  if (!current) throw new Error('Media not found');

  const updated = await queryOne<any>(
    `UPDATE public.seo_media SET
      alt = COALESCE($1, alt),
      title = COALESCE($2, title),
      caption = COALESCE($3, caption),
      description = COALESCE($4, description),
      credit = COALESCE($5, credit),
      license = COALESCE($6, license),
      focus_x = COALESCE($7, focus_x),
      focus_y = COALESCE($8, focus_y),
      updated_at = now()
    WHERE id = $9
    RETURNING *`,
    [
      input.altText !== undefined ? input.altText : null,
      input.title !== undefined ? input.title : null,
      input.caption !== undefined ? input.caption : null,
      input.description !== undefined ? input.description : null,
      input.credit !== undefined ? input.credit : null,
      input.license !== undefined ? input.license : null,
      input.focusX !== undefined ? input.focusX : null,
      input.focusY !== undefined ? input.focusY : null,
      id,
    ]
  );

  await logAudit({
    actorId,
    action: 'media.update',
    entityType: 'media',
    entityId: id,
    beforeState: current,
    afterState: updated,
  });

  return normalizeMediaRow(updated);
}

/**
 * Delete media item with usage protection (FR-MED-002)
 */
export async function deleteMedia(id: string, actorId: string) {
  const current = await queryOne<any>(`SELECT * FROM public.seo_media WHERE id = $1`, [id]);
  if (!current) throw new Error('Media not found');

  // Check usage in seo_posts (featured image) or seo_media_usage
  const usages = await query<any>(
    `SELECT 'featured_image' as field_name, p.title as post_title, p.slug as post_slug
     FROM public.seo_posts p
     WHERE p.featured_media_id = $1
     UNION
     SELECT u.field as field_name, p.title as post_title, p.slug as post_slug
     FROM public.seo_media_usage u
     JOIN public.seo_posts p ON p.id = u.entity_id AND u.entity_type = 'post'
     WHERE u.media_id = $1`,
    [id]
  );

  if (usages.length > 0) {
    const error: any = new Error(
      `Cannot delete media: it is currently used in ${usages.length} post(s) (${usages.map(u => u.post_title).join(', ')}). Remove it from posts before deleting.`
    );
    error.status = 409;
    error.usage = usages;
    throw error;
  }

  // Delete physical file if exists
  if (current.storage_path) {
    const relPath = current.storage_path.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', relPath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // Ignore if already deleted
    }
  }

  await query(`DELETE FROM public.seo_media WHERE id = $1`, [id]);

  await logAudit({
    actorId,
    action: 'media.delete',
    entityType: 'media',
    entityId: id,
    beforeState: current,
  });

  return { success: true };
}
