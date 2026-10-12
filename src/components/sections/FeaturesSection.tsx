import React from 'react';
import Link from 'next/link';
import BrandIcon from '@/components/ui/BrandIcon';

import { features } from '@/content/home';

export default function FeaturesSection() {
  return (
    <section className="features container reveal" aria-label="Explore pathways" style={{ '--delay': '200ms' } as React.CSSProperties}>
      {features.map((f, i) => (
        <Link
          key={f.service.slug}
          href={`/services/${f.service.slug}/`}
          className={`feature${i === 0 ? ' active' : ''}`}
        >
          <BrandIcon slot={f.icon} />
          <h2>{f.title}</h2>
          <p>{f.desc}</p>
          <div className="feature-number">
            <span>0{i + 1}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
