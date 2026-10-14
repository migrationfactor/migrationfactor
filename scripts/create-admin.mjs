// Creates (or re-authorises) an admin login for /admin.
// Usage: ADMIN_PASSWORD='a-long-password' npm run admin:create -- admin@example.com
// Without ADMIN_PASSWORD a random password is generated and printed once.
// An existing user keeps their password unless ADMIN_PASSWORD is supplied.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile('.env.local'); } catch {}
try { process.loadEnvFile('.env'); } catch {}

const email = (process.argv[2] || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- admin@example.com');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.');
  process.exit(1);
}
const supplied = process.env.ADMIN_PASSWORD || '';
if (supplied && supplied.length < 12) {
  console.error('ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user;
  }
  return undefined;
}

let user = await findUser();
let password = '';
if (!user) {
  password = supplied || randomBytes(18).toString('base64url');
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  user = data.user;
  console.log(`Created auth user ${email}.`);
} else if (supplied) {
  const { error } = await supabase.auth.admin.updateUserById(user.id, { password: supplied });
  if (error) throw error;
  console.log(`Updated the password for ${email}.`);
} else {
  console.log(`Auth user ${email} already exists; password unchanged.`);
}

const { error } = await supabase.from('admin_users').upsert({ user_id: user.id, email, role: 'owner' }, { onConflict: 'user_id' });
if (error) throw error;
console.log(`${email} can now sign in at /admin/login.`);
if (password && !supplied) console.log(`Temporary password (shown once): ${password}`);
