import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createUserClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';

export interface AdminSession {
  userId: string;
  email: string;
}

/** Verifies the session with Supabase Auth and checks admin membership (RLS-protected). */
export const getAdmin = cache(async (): Promise<AdminSession | null> => {
  if (!supabaseConfigured()) return null;
  const supabase = await createUserClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: membership } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return null;
  return { userId: user.id, email: user.email || '' };
});

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
