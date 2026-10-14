/** Supabase settings shared by server code. Secret values are never read in client components. */
export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function supabasePublicKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

export function supabaseSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublicKey() && supabaseSecretKey());
}
