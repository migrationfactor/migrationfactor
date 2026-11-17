'use client';
import { usePathname } from 'next/navigation';

/**
 * Hides the site-wide Organization/WebSite JSON-LD on WordPress-migrated posts, whose preserved Rank Math graph
 * already declares both (avoids duplicate schemas). Migrated posts are the only pages served at a single-segment
 * path WITH a trailing slash (src/proxy.ts strips the slash from every other URL).
 */
export default function SiteJsonLdGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return /^\/[^/]+\/$/.test(pathname) ? null : children;
}
