'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Child = { label: string; href: string; external?: boolean };
type Entry = { label: string; href: string; icon: string; children?: Child[] };

const ICONS: Record<string, string> = {
  dashboard: 'M12 4a9 9 0 0 0-9 9c0 2.2.8 4.2 2.1 5.8h13.8A9 9 0 0 0 12 4Zm0 2a7 7 0 0 1 6.7 5h-2.1l-2.9.9-1.6-2.3-1.5 1.6L9 10H5.3A7 7 0 0 1 12 6Z',
  posts: 'm14 3 7 7-2 2-1-1-4 4v5l-2 1-3-3-5 5-1-1 5-5-3-3 1-2h5l4-4-1-1 2-2Z',
  media: 'M4 5h16v14H4V5Zm2 2v8l3-3 3 3 3-4 3 4V7H6Zm3 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  seo: 'M5 20V10h3v10H5Zm5.5 0V4h3v16h-3ZM16 20v-7h3v7h-3Z',
  users: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2 8 4.5V20H4v-1.5C4 16 7.6 14 12 14Z',
  tools: 'M20.6 6.4 17 10l-3-3 3.6-3.6a5 5 0 0 0-6.2 6.6L3.6 17.8 6.2 20.4l7.8-7.8a5 5 0 0 0 6.6-6.2Z',
};

const MENU: Entry[] = [
  { label: 'Dashboard', href: '/seo-admin', icon: 'dashboard' },
  {
    label: 'Posts', href: '/seo-admin/blog', icon: 'posts',
    children: [
      { label: 'All Posts', href: '/seo-admin/blog' },
      { label: 'Add New', href: '/seo-admin/blog/new' },
      { label: 'Categories', href: '/seo-admin/blog/categories' },
      { label: 'Tags', href: '/seo-admin/blog/tags' },
      { label: 'Authors', href: '/seo-admin/blog/authors' },
    ],
  },
  { label: 'Media', href: '/seo-admin/media', icon: 'media' },
  {
    label: 'SEO', href: '/seo-admin/seo/reports', icon: 'seo',
    children: [
      { label: 'Reports', href: '/seo-admin/seo/reports' },
      { label: 'Redirects', href: '/seo-admin/seo/redirects' },
      { label: 'Robots.txt', href: '/seo-admin/seo/robots' },
      { label: 'Sitemaps & Indexing', href: '/seo-admin/seo/indexing' },
      { label: 'Integrations', href: '/seo-admin/seo/integrations' },
      { label: 'Settings', href: '/seo-admin/seo/settings' },
    ],
  },
  { label: 'Users', href: '/seo-admin/seo/users', icon: 'users', children: [{ label: 'Users & Roles', href: '/seo-admin/seo/users' }] },
  {
    label: 'Tools', href: '/seo-admin/seo/audit-log', icon: 'tools',
    children: [
      { label: 'Audit Log', href: '/seo-admin/seo/audit-log' },
      { label: 'XML Sitemap ↗', href: '/sitemap_index.xml', external: true },
    ],
  },
];

function Icon({ name }: { name: string }) {
  return (
    <svg className="sa-menu-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={ICONS[name]} fill="currentColor" />
    </svg>
  );
}

/** WordPress-style admin bar, collapsible left menu and content frame for the SEO admin. */
export default function SeoAdminChrome({ name, roles, children }: { name: string; roles: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  // The deepest matching link wins, so /seo-admin/blog/12 highlights "All Posts" and /blog/tags highlights "Tags".
  const links = MENU.flatMap((m) =>
    (m.children ?? [{ label: m.label, href: m.href }])
      .filter((c) => !('external' in c && c.external))
      .map((c) => ({ href: c.href, parent: m.href })),
  );
  const match = links
    .filter((l) => (l.href === '/seo-admin' ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className={`sa-root${open ? ' sa-menu-open' : ''}`}>
      <header className="sa-bar">
        <button type="button" className="sa-bar-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span /><span /><span />
        </button>
        <Link href="/seo-admin" className="sa-bar-item sa-bar-site"><span className="sa-bar-logo">MF</span><span>Migration Factor SEO</span></Link>
        <Link href="/" className="sa-bar-item sa-bar-hide-sm" target="_blank">View site</Link>
        <Link href="/seo-admin/blog/new" className="sa-bar-item"><span aria-hidden="true">＋</span> New</Link>
        <div className="sa-bar-spacer" />
        <span className="sa-bar-item sa-bar-user" title={roles}>Howdy, {name}</span>
        <form action="/api/v1/auth/logout" method="POST" className="sa-bar-form">
          <button type="submit" className="sa-bar-item sa-bar-signout">Log Out</button>
        </form>
      </header>

      <div className="sa-body">
        <nav className="sa-menu" aria-label="SEO admin">
          <ul>
            {MENU.map((entry) => {
              const current = match?.parent === entry.href;
              return (
                <li key={entry.href} className={current ? 'is-current' : undefined}>
                  <Link href={entry.href} aria-current={current && !entry.children ? 'page' : undefined}>
                    <Icon name={entry.icon} /><span>{entry.label}</span>
                  </Link>
                  {entry.children && current && (
                    <ul className="sa-submenu">
                      {entry.children.map((child) => (
                        <li key={child.href} className={match?.href === child.href ? 'is-current' : undefined}>
                          {child.external
                            ? <a href={child.href} target="_blank" rel="noopener noreferrer">{child.label}</a>
                            : <Link href={child.href} aria-current={match?.href === child.href ? 'page' : undefined}>{child.label}</Link>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <button type="button" className="sa-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
        <main className="sa-main"><div className="sa-wrap">{children}</div></main>
      </div>
    </div>
  );
}
