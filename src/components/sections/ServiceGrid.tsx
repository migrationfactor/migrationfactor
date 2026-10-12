import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { services, getServiceImage } from '@/content/services';

export default function ServiceGrid() {
  return (
    <div className="service-grid visa-grid">
      {services.map((s, i) => (
        <article
          key={s.slug}
          className="service-card visa-card reveal"
          style={{ '--delay': `${(i % 3) * 100}ms` } as React.CSSProperties}
        >
          <div className="visa-card-body">
          <Icon type={s.icon} />
          <h2>
            <Link href={`/services/${s.slug}/`}>{s.name}</Link>
          </h2>
          <p>{s.description}</p>
          <Link className="visa-know-more" href={`/services/${s.slug}/`} aria-label={`Know more about ${s.name}`}>
            <span aria-hidden="true">↗</span> Know More
          </Link>
          </div>
          <Link className="visa-card-photo" href={`/services/${s.slug}/`} aria-label={`View ${s.name}`} tabIndex={-1}>
            <Image {...getServiceImage(s)} alt={getServiceImage(s).alt} sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 400px" />
          </Link>
        </article>
      ))}
    </div>
  );
}
