'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** The reference's eight-bar preloader, without delaying a ready page. */
export default function PageLoader() {
  const pathname = usePathname();
  const [active, setActive] = useState(true);

  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelFrames = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
    const finish = () => {
      cancelFrames();
      clearTimeout(safetyTimer);
      // Allow the newly committed page to paint, without waiting for below-fold images.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setActive(false));
      });
    };
    const start = () => {
      cancelFrames();
      clearTimeout(safetyTimer);
      setActive(true);
      // A cancelled/failed navigation must never leave the site covered.
      safetyTimer = setTimeout(() => setActive(false), 5000);
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const next = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (next.origin !== current.origin || next.pathname.replace(/\/$/, '') === current.pathname.replace(/\/$/, '')) return;
      if (next.protocol !== 'http:' && next.protocol !== 'https:') return;
      start();
    };
    const historyNavigation = () => {
      if (window.location.pathname !== pathname) start();
    };

    finish();
    document.addEventListener('click', navigate, true);
    window.addEventListener('popstate', historyNavigation);
    window.addEventListener('pageshow', finish);
    return () => {
      cancelFrames();
      clearTimeout(safetyTimer);
      document.removeEventListener('click', navigate, true);
      window.removeEventListener('popstate', historyNavigation);
      window.removeEventListener('pageshow', finish);
    };
  }, [pathname]);

  return (
    <div className="page-loader" data-active={active} aria-hidden={!active} role="status" aria-label="Loading page">
      <div className="page-loader-bars" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <span key={index} style={{ animationDelay: `${(7 - index) * 0.1}s` }} />)}
      </div>
    </div>
  );
}
