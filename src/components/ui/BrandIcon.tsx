import React from 'react';
import { images } from '@/content/media';

interface BrandIconProps {
  slot: string;
}

/** Preserve the supplied icon's silhouette while using the live brand color. */
export default function BrandIcon({ slot }: BrandIconProps) {
  const im = images[slot];
  if (!im) return null;
  return (
    <span
      className="brand-icon"
      aria-hidden="true"
      style={{ '--icon': `url('${im.src}')` } as React.CSSProperties}
    />
  );
}
