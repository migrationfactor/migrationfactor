import React from 'react';
import Image from 'next/image';
import { images } from '@/content/media';

interface SiteImageProps {
  slot: string;
  className?: string;
  eager?: boolean;
}

export default function SiteImage({ slot, className = '', eager = false }: SiteImageProps) {
  const im = images[slot];
  if (!im) return null;
  return (
    <Image
      className={className}
      src={im.src}
      alt={im.alt}
      width={im.width}
      height={im.height}
      sizes={im.width <= 150 ? `${im.width}px` : '(max-width: 767px) calc(100vw - 36px), (max-width: 1199px) 45vw, 600px'}
      priority={eager}
      loading={eager ? 'eager' : 'lazy'}
      style={{ objectPosition: 'center' }}
    />
  );
}
