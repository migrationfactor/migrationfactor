'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const GIVE_UP_MS = 20000;

/** True when a click should start an in-app admin navigation to a different URL. */
function navigationTarget(event: MouseEvent, current: string): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const link = (event.target as Element | null)?.closest?.('a');
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  return url.origin === window.location.origin && url.pathname.startsWith('/admin') && url.pathname + url.search !== current;
}

/**
 * Animated bar at the top of the admin panel. It starts the moment a link is clicked or the filters
 * are applied, and runs until the next page (or its loading skeleton, which shows the same bar) appears.
 */
export default function AdminProgress() {
  const search = useSearchParams().toString();
  const current = usePathname() + (search ? `?${search}` : '');
  const [loading, setLoading] = useState(false);
  const [shownFor, setShownFor] = useState(current);
  const timer = useRef<number | undefined>(undefined);

  // The URL changed, so the new page or its skeleton is now on screen.
  if (shownFor !== current) {
    setShownFor(current);
    setLoading(false);
  }

  useEffect(() => {
    const start = () => {
      setLoading(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLoading(false), GIVE_UP_MS);
    };
    const onClick = (event: MouseEvent) => { if (navigationTarget(event, current)) start(); };
    const onSubmit = (event: SubmitEvent) => { if ((event.target as HTMLFormElement).method === 'get') start(); };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [current]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return loading ? <div className="admin-progress" aria-hidden="true"><span /></div> : null;
}
