'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { label: string; href: string; exact?: boolean; external?: boolean };
const groups: { title: string; items: Item[] }[] = [
  { title: 'Core', items: [{ label: 'Dashboard', href: '/seo-admin', exact: true }] },
  {
    title: 'Editorial',
    items: [
      { label: 'All posts', href: '/seo-admin/blog', exact: true },
      { label: 'Add new post', href: '/seo-admin/blog/new' },
      { label: 'Categories', href: '/seo-admin/blog/categories' },
      { label: 'Tags', href: '/seo-admin/blog/tags' },
      { label: 'Authors', href: '/seo-admin/blog/authors' },
    ],
  },
  {
    title: 'Assets & engine',
    items: [
      { label: 'Media library', href: '/seo-admin/media' },
      { label: 'Redirects (301)', href: '/seo-admin/seo/redirects' },
      { label: 'Robots.txt', href: '/seo-admin/seo/robots' },
      { label: 'SEO reports', href: '/seo-admin/seo/reports' },
      { label: 'Sitemaps & indexing', href: '/seo-admin/seo/indexing' },
      { label: 'Integrations', href: '/seo-admin/seo/integrations' },
      { label: 'SEO settings', href: '/seo-admin/seo/settings' },
      { label: 'Users & roles', href: '/seo-admin/seo/users' },
      { label: 'Audit log', href: '/seo-admin/seo/audit-log' },
      { label: 'XML sitemap ↗', href: '/sitemap_index.xml', external: true },
    ],
  },
];

/** Sidebar links for the SEO panel, using the same admin-nav styling and active state as /admin. */
export default function SeoAdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="SEO admin">
      {groups.map((group) => (
        <div key={group.title} className="admin-nav-group">
          <p className="admin-nav-title">{group.title}</p>
          {group.items.map((item) => {
            if (item.external) {
              return (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                  <span>{item.label}</span>
                </a>
              );
            }
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
