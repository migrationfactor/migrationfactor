import { NextRequest, NextResponse } from 'next/server';
import { createUserClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/config';

// Shared login: signing out of the SEO panel signs out of the main admin as well.
export async function POST(req: NextRequest) {
  if (supabaseConfigured()) {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  }
  // Form posts (the sidebar button) get redirected to the login page; fetch callers get JSON.
  if ((req.headers.get('accept') || '').includes('text/html')) {
    return NextResponse.redirect(new URL('/seo-admin/login', req.url), 303);
  }
  return NextResponse.json({ success: true });
}
