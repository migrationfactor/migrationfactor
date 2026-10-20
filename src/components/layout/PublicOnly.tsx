'use client';
import { usePathname } from 'next/navigation';

/** Renders public-site chrome everywhere except the admin panel and the document signing pages. */
export default function PublicOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/sign/')) return null;
  return children;
}
