'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links: [string, string][] = [
  ['Dashboard', '/admin'],
  ['Contact leads', '/admin/leads'],
  ['Tool leads', '/admin/tool-leads'],
  ['Bookings', '/admin/bookings'],
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin">
      {links.map(([label, href]) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
