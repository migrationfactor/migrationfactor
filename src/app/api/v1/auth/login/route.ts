import { NextRequest, NextResponse } from 'next/server';
import { createUserClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';
import { getMainAdminSeoSession } from '@/lib/seo-system/admin-bridge';
import { logAudit } from '@/lib/seo-system/audit';

/**
 * The SEO panel shares the main admin login: credentials are verified by Supabase Auth and the
 * account must be listed in `admin_users`, exactly like /admin/login.
 */
export async function POST(req: NextRequest) {
  try {
    if (!supabaseConfigured()) {
      return NextResponse.json({ error: 'not_configured', message: 'Admin sign-in is not configured on this server.' }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 200) {
      return NextResponse.json({ error: 'validation_failed', message: 'Enter your admin email and password.' }, { status: 422 });
    }

    const supabase = await createUserClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: 'invalid_credentials', message: 'Incorrect email or password.' }, { status: 401 });
    }
    const { data: membership } = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (!membership) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: 'forbidden', message: 'This account does not have admin access.' }, { status: 403 });
    }

    const session = await getMainAdminSeoSession();
    if (session) {
      await logAudit({
        actorId: session.user.id,
        action: 'auth.login',
        entityType: 'user',
        entityId: session.user.id,
        afterState: { email, via: 'admin-sso' },
      });
    }
    return NextResponse.json({ success: true, user: { email, roles: ['super_admin'] } });
  } catch (err: any) {
    return NextResponse.json({ error: 'server_error', message: 'An unexpected error occurred.' }, { status: 500 });
  }
}
