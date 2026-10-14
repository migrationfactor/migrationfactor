'use client';
import { useActionState } from 'react';
import { signIn } from '@/app/admin/actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form className="admin-login-form" action={action}>
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} defaultValue={state.email} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={200} /></label>
      <button type="submit" className="admin-button" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
      <p className="admin-message error" role="alert">{state.message}</p>
    </form>
  );
}
