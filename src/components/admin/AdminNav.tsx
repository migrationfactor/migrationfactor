'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NewLeadCounts } from '@/lib/admin/queries';

const links: [string, string, keyof NewLeadCounts | null][] = [
  ['Dashboard', '/admin', null],
  ['WhatsApp leads', '/admin/whatsapp-leads', 'whatsapp'],
  ['Email leads', '/admin/email-leads', 'email'],
  ['Contact form leads', '/admin/leads', 'contact'],
  ['Bookings', '/admin/bookings', 'booking'],
  ['Tool leads', '/admin/tool-leads', 'tool'],
  ['Invoices', '/admin/invoices', null],
  ['Signature Requests', '/admin/signature-requests', null],
  ['Settings', '/admin/settings', null],
];

const REFRESH_MS = 60000;

async function fetchNewLeadCounts(): Promise<NewLeadCounts> {
  const response = await fetch('/admin/counts', { cache: 'no-store' });
  if (!response.ok) throw new Error('Counts unavailable');
  return response.json();
}

/** Sidebar links with a count of leads that arrived since the section was last opened, like notifications. */
export default function AdminNav({ initialCounts }: { initialCounts: NewLeadCounts }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState(initialCounts);
  const firstRender = useRef(true);

  // Refresh on navigation, every minute, and when the tab regains focus, so new leads appear without a reload.
  useEffect(() => {
    let active = true;
    const refresh = () => { fetchNewLeadCounts().then(next => { if (active) setCounts(next); }).catch(() => undefined); };
    // The server already rendered fresh counts for the first page; refresh only after navigation.
    if (firstRender.current) firstRender.current = false; else refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [pathname]);

  return (
    <nav className="admin-nav" aria-label="Admin">
      {links.map(([label, href, key]) => {
        const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
        // The open section is being looked at, so its badge clears straight away.
        const waiting = key && !active ? counts[key] : 0;
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <span>{label}</span>
            {waiting > 0 && <span className="admin-nav-alert"><span className="admin-nav-dot" aria-hidden="true" /><span className="admin-nav-count">{waiting > 99 ? '99+' : waiting}</span><span className="sr-only"> not opened</span></span>}
          </Link>
        );
      })}
    </nav>
  );
}
