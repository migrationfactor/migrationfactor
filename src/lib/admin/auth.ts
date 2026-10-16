import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';

export interface AdminSession {
  userId: string;
  email: string;
}

/**
 * Verifies the session JWT signature locally (the project signs with asymmetric ES256 keys, so
 * no Auth server round trip), then checks admin membership in the database on every request,
 * so removing an admin takes effect immediately.
 */
export const getAdmin = cache(async (): Promise<AdminSession | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const { data: membership } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', claims.sub)
    .maybeSingle();
  if (!membership) return null;
  return { userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
});

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

/**
 * Runs admin reads at the same time as the admin check instead of after it, saving a database
 * round trip per page. RLS still returns nothing to non-admins, and the check still redirects them.
 */
export async function withAdmin<T>(load: Promise<T>): Promise<T> {
  load.catch(() => undefined);
  await requireAdmin();
  return load;
}
