import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseSecretKey, supabaseUrl } from './config';

/**
 * Server-only client using the secret key. It bypasses RLS, so it is used only by
 * public form endpoints after validation and never exposed to the browser.
 */
export function createServiceClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseSecretKey();
  if (!url || !key) throw new Error('Supabase is not configured.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
