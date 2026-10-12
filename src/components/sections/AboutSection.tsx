import React from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import WordReveal from '@/components/shared/WordReveal';
import { company } from '@/content/company';
import { about } from '@/content/about';
import ServiceCount from '@/components/shared/ServiceCount';

export default function AboutSection() {
  return (
    <section className="section about-section">
      <Image className="about-landmarks" src="/media/aboutLandmarks.webp" width={800} height={803} alt="" aria-hidden="true" />
      <div className="container about-grid">
        <div>
          <div className="section-heading">
            <span className="eyebrow">{about.summary.label}</span>
            <h2 className="split">
              <WordReveal>
              {about.summary.headingLines[0]} <br />
              {about.summary.headingLines[1]}
              </WordReveal>
            </h2>
          </div>
          <p className="reveal" style={{ '--delay': '100ms' } as React.CSSProperties}>{company.overview}</p>
          <div className="about-support">
            <ul className="checks">
              {about.summary.checks.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <Button text={about.summary.button} href="/about/" variant="outline" />
        </div>
        <div className="about-photo reveal" style={{ '--delay': '100ms' } as React.CSSProperties}>
          <Image
            src="/media/about.webp"
            alt="Reference photograph of a visa consultant"
            width={800}
            height={800}
            sizes="(max-width: 767px) calc(100vw - 36px), (max-width: 1199px) 45vw, 600px"
            loading="lazy"
            style={{ objectPosition: 'center' }}
          />
          <ServiceCount />
        </div>
      </div>
    </section>
  );
}
