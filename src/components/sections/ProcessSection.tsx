import React from 'react';
import Image from 'next/image';
import { home, steps } from '@/content/home';
import WordReveal from '@/components/shared/WordReveal';

const processImages = [
  '/media/processOne.webp',
  '/media/processTwo.webp',
  '/media/processThree.webp',
  '/media/processThree.webp',
];

export default function ProcessSection() {
  return (
    <section className="section process-section">
      <div className="section-heading center">
        <span className="eyebrow">{home.process.label}</span>
        <h2 className="split">
          <WordReveal>
          {home.process.headingLines[0]} <br />
          {home.process.headingLines[1]}
          </WordReveal>
        </h2>
      </div>
      <div className="container steps reveal" style={{ '--delay': '100ms' } as React.CSSProperties}>
        <Image
          className="process-track-image"
          src="/media/processTrack.webp"
          alt=""
          width={1900}
          height={173}
          loading="lazy"
          style={{ objectPosition: 'center' }}
        />
        {steps.map(([name, desc], i) => (
          <article
            key={name}
            className="step"
          >
            <div className="step-track">
              <span>0{i + 1}</span>
              <Image
                className="process-icon"
                src={processImages[i]}
                alt=""
                width={200}
                height={200}
                loading="lazy"
                style={{ objectPosition: 'center' }}
              />
            </div>
            <h3>{name}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
