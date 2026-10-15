import { home } from '@/content/home';
import React from 'react';
import Image from 'next/image';
import SiteImage from '@/components/ui/SiteImage';
import Button from '@/components/ui/Button';
import WordReveal from '@/components/shared/WordReveal';
import type { ImageMeta } from '@/content/media';

export default function CtaSection({ destinationImage }: { destinationImage?: ImageMeta } = {}) {
  return (
    <section className="section cta-section">
      <div className="container cta">
        <div className="cta-wave" aria-hidden="true" />
        <div className="cta-image">
          {destinationImage ? <Image {...destinationImage} alt={destinationImage.alt} className="cta-person cta-destination reveal" sizes="(max-width: 767px) 100vw, 600px" /> : <SiteImage slot="cta" className="cta-person reveal" />}
          <div className="cta-decorations" aria-hidden="true">
            <Image className="cta-plane" src="/media/ctaPlane.webp" width={278} height={260} alt="" />
            <span className="cta-landscape" />
            <Image className="cta-stamp" src="/media/ctaStamp.webp" width={101} height={89} alt="" />
            <Image className="cta-route" src="/media/ctaRoute.webp" width={263} height={73} alt="" />
          </div>
        </div>
        <div className="cta-copy">
          <span className="eyebrow light">{home.cta.label}</span>
          <h2 className="split">
            <WordReveal>
            {home.cta.headingLines[0]} <br />
            {home.cta.headingLines[1]}
            </WordReveal>
          </h2>
          <Button text={home.cta.button} href="/contact/" className="reveal" />
        </div>
      </div>
    </section>
  );
}
