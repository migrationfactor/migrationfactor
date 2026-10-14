'use client';
import { usePathname } from 'next/navigation';

/** Renders public-site chrome everywhere except the admin panel. */
export default function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return children;
}
