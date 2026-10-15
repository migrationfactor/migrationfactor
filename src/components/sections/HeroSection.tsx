import React from 'react';
import Image, { getImageProps } from 'next/image';
import Button from '@/components/ui/Button';
import WordReveal from '@/components/shared/WordReveal';
import HeroFlights from '@/components/shared/HeroFlights';
import { home } from '@/content/home';

export default function HeroSection() {
  // A lossless centre crop removes only pixels hidden by object-fit on narrow
  // phones. Keep sufficient source height so the approved photo stays sharp.
  const mobile = getImageProps({ src: '/media/hero-mobile.webp', width: 950, height: 950, sizes: '640px', alt: '', loading: 'eager' }).props;
  return (
    <section className="hero">
      <picture style={{ position: 'absolute', inset: 0, zIndex: -3 }}>
      <source media="(max-width: 430px)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
      <Image
        className="hero-image"
        src="/media/hero.webp"
        alt="Family with luggage at an airport"
        width={1900}
        height={950}
        sizes="(max-width: 767px) 1100px, 100vw"
        fetchPriority="high"
        loading="eager"
        style={{ objectPosition: 'center' }}
      />
      </picture>
      <div className="hero-shade" />
      <div className="hero-diagonal" aria-hidden="true" />
      <div className="container hero-content">
        <HeroFlights />
        <h1 className="split">
          <WordReveal>
          {home.hero.headingLines[0]} <br />
          {home.hero.headingLines[1]}
          </WordReveal>
        </h1>
        <p className="reveal" style={{ '--delay': '100ms' } as React.CSSProperties}>
          {home.hero.description}
          <br className="desktop" /> {home.hero.supportingText}
        </p>
        <div className="reveal" style={{ '--delay': '300ms' } as React.CSSProperties}>
          <Button text={home.hero.button} href={home.hero.buttonHref} />
        </div>
      </div>
    </section>
  );
}
