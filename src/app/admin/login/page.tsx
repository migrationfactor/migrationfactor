import Image from 'next/image';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/admin/LoginForm';
import { getAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'Sign in' };

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <Image src="/brand/mark.webp" width={72} height={72} alt="Migration Factor" priority />
        <h1>Admin sign in</h1>
        <p>Authorised Migration Factor staff only.</p>
        <LoginForm />
      </div>
    </div>
  );
}
