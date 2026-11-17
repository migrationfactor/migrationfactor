if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}

import { query } from './db';

export type SeoRole = 'super_admin' | 'admin' | 'seo_manager' | 'editor' | 'author';

export interface SeoUser {
  id: string;
  email: string;
  name: string;
  roles: SeoRole[];
  status: string;
}

export const PERMISSION_MATRIX: Record<SeoRole, Set<string>> = {
  super_admin: new Set([
    'post.create', 'post.edit', 'post.edit_any', 'post.publish', 'post.delete', 'post.delete_permanent',
    'seo.edit', 'seo.edit_advanced', 'seo.reports',
    'robots.edit', 'redirects.edit', 'sitemaps.manage', 'indexing.submit', 'gsc.connect',
    'schema.edit', 'schema.edit_custom', 'taxonomy.manage', 'authors.manage',
    'media.upload', 'media.edit', 'media.delete',
    'settings.seo_global', 'settings.permalinks', 'users.manage', 'audit.read',
  ]),
  admin: new Set([
    'post.create', 'post.edit', 'post.edit_any', 'post.publish', 'post.delete', 'post.delete_permanent',
    'seo.edit', 'seo.edit_advanced', 'seo.reports',
    'redirects.edit', 'sitemaps.manage', 'indexing.submit',
    'schema.edit', 'schema.edit_custom', 'taxonomy.manage', 'authors.manage',
    'media.upload', 'media.edit', 'media.delete',
    'settings.seo_global', 'users.manage', 'audit.read',
  ]),
  seo_manager: new Set([
    'post.create', 'post.edit', 'post.edit_any', 'post.publish',
    'seo.edit', 'seo.edit_advanced', 'seo.reports',
    'robots.edit', 'redirects.edit', 'sitemaps.manage', 'indexing.submit',
    'schema.edit', 'schema.edit_custom', 'taxonomy.manage', 'authors.manage',
    'media.upload', 'media.edit',
    'settings.seo_global', 'audit.read',
  ]),
  editor: new Set([
    'post.create', 'post.edit', 'post.edit_any', 'post.publish', 'post.delete',
    'seo.edit', 'seo.reports',
    'indexing.submit',
    'schema.edit', 'taxonomy.manage',
    'media.upload', 'media.edit', 'media.delete',
  ]),
  author: new Set([
    'post.create', 'post.edit',
    'seo.edit',
    'media.upload',
  ]),
};

/**
 * Checks whether any of the user's roles has the requested permission.
 */
export function hasPermission(roles: SeoRole[], permission: string): boolean {
  for (const role of roles) {
    const perms = PERMISSION_MATRIX[role];
    if (perms && perms.has(permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a distinct array of all permissions granted across the given roles.
 */
export function getUserPermissions(roles: SeoRole[]): string[] {
  const permsSet = new Set<string>();
  for (const role of roles) {
    const perms = PERMISSION_MATRIX[role];
    if (perms) {
      perms.forEach((p) => permsSet.add(p));
    }
  }
  return Array.from(permsSet);
}

/**
 * Checks object-level permission for post actions.
 * Authors can only edit own drafts/pending, and cannot change advanced robots/canonical.
 */
export function canEditPost(user: SeoUser, post: { created_by?: string | null; status?: string }): boolean {
  if (hasPermission(user.roles, 'post.edit_any')) return true;
  if (!hasPermission(user.roles, 'post.edit')) return false;

  // Author can only edit own drafts or pending posts
  const isOwner = post.created_by === user.id;
  const isDraftOrPending = post.status === 'draft' || post.status === 'pending_review';
  return isOwner && isDraftOrPending;
}

/**
 * Fetches user permissions from DB or returns matrix
 */
export async function getUserRoles(userId: string): Promise<SeoRole[]> {
  const rows = await query<{ role_id: SeoRole }>(
    `SELECT role_id FROM public.seo_user_roles WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.role_id);
}
