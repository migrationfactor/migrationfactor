'use client';

import { useEffect, useRef, useState } from 'react';
const serviceCount = 500;

/** Animate the requested service count when the badge enters view. */
export default function ServiceCount() {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(serviceCount);

  useEffect(() => {
    const element = ref.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (preference.matches) return;
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - started) / 4000, 1);
        setCount(Math.round(serviceCount * progress));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(element);
    const stop = () => {
      if (preference.matches) {
        cancelAnimationFrame(frame);
        setCount(serviceCount);
      }
    };
    preference.addEventListener('change', stop);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      preference.removeEventListener('change', stop);
    };
  }, []);

  return (
    <div ref={ref} className="about-badge reveal reveal-down" aria-label={`${serviceCount}+ clients supported`}>
      <strong aria-hidden="true">{count}+</strong>
      <span aria-hidden="true">Clients<br />supported</span>
    </div>
  );
}
