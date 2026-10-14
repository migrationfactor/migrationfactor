import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import WhatsAppIcon from '@/components/ui/WhatsAppIcon';
import { company, socialLinks } from '@/content/company';
import { navigation } from '@/content/navigation';
import { services } from '@/content/services';

export default function Footer() {
  const year = 2026;
  const footerServices = services.filter((_, i) => [0, 3, 5, 6].includes(i));

  return (
    <>
      <footer className="site-footer">
        <div className="footer-contact">
          <div className="container">
            <a href={`tel:${company.tel}`}>
              <Icon type="phone" />
              <span>
                <small>Call our team</small>
                {company.phone}
              </span>
            </a>
            <a href={`mailto:${company.email}`}>
              <Icon type="mail" />
              <span>
                <small>Email</small>
                {company.email}
              </span>
            </a>
            <div>
              <Icon type="pin" />
              <span>
                <small>Our offices</small>
                Perth &amp; Melbourne, Australia
              </span>
            </div>
          </div>
        </div>
        <div className="footer-body">
          <Image unoptimized loading="lazy" className="footer-plane" src="/brand/footer-airplane-reference.png" width={276} height={276} alt="" aria-hidden="true" decoding="async" />
        <div className="container footer-main">
          <div className="footer-brand-panel">
            <Link className="brand" href="/" aria-label="Migration Factor home">
              <svg
                className="brand-mark footer-logo"
                viewBox="0 0 600 554"
                width={600}
                height={554}
                aria-hidden="true"
                focusable={false}
              >
                <defs>
                  <filter
                    id="footer-logo-alpha"
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feColorMatrix
                      type="matrix"
                      values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 9 9 9 0 -8.1"
                    />
                  </filter>
                  <clipPath id="footer-logo-symbol">
                    <rect width="600" height="445" />
                  </clipPath>
                  <clipPath id="footer-logo-lettering">
                    <rect y="445" width="600" height="65" />
                  </clipPath>
                  <clipPath id="footer-logo-tagline">
                    <rect y="510" width="600" height="44" />
                  </clipPath>
                </defs>
                <g filter="url(#footer-logo-alpha)">
                  <image
                    href="/brand/footer-logo.webp"
                    x="-103"
                    width="600"
                    height="554"
                    clipPath="url(#footer-logo-symbol)"
                  />
                  <image
                    href="/brand/footer-logo.webp"
                    width="600"
                    height="554"
                    clipPath="url(#footer-logo-lettering)"
                  />
                  <image
                    href="/brand/footer-logo.webp"
                    x="-58"
                    width="600"
                    height="554"
                    clipPath="url(#footer-logo-tagline)"
                  />
                </g>
              </svg>
            </Link>
            <p>
              Personalized, professional and transparent visa support for students, professionals
              and families.
            </p>
            <a className="footer-contact-link" href="/contact/">
              Request an eligibility assessment <span aria-hidden="true">↗</span>
            </a>
            <ul className="footer-social" aria-label="Contact and social links">
              <li><a href={company.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Chat on WhatsApp at ${company.phone} (opens in a new tab)`}><WhatsAppIcon /></a></li>
              {socialLinks.filter((link) => link.url).map((link) => (
                <li key={link.name}><a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${company.name} on ${link.name} (opens in a new tab)`}>{link.name}</a></li>
              ))}
            </ul>
            <div className="footer-ornament" aria-hidden="true"><span /><i /><b /></div>
          </div>
          <div>
            <h3>Explore</h3>
            {[...navigation.slice(1), ['Countries', '/countries/'], ['FAQ', '/faq/'], ['Book a consultation', '/consultation']].map(([name, url]) => (
              <Link key={url} href={url}>
                {name}
              </Link>
            ))}
          </div>
          <div>
            <h3>Our services</h3>
            {footerServices.map((s) => (
              <Link key={s.slug} href={`/services/${s.slug}/`}>
                {s.name}
              </Link>
            ))}
            <Link href="/coaching/ielts/">IELTS Coaching</Link>
            <Link href="/coaching/pte/">PTE Coaching</Link>
          </div>
          <div className="footer-offices">
            <h3>Visit our offices</h3>
            <p>{company.offices[0]}</p>
            <p>{company.offices[1]}</p>
            <p>{company.hours}</p>
            <Link className="footer-visit" href="/contact/">Contact before visiting <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        </div>
        <div className="footer-legal">
          <div className="container">
            <span>© {year} Migration Factor</span>
            <a href="https://www.bshsolutionss.com/">Powered by BSH Solutions</a>
          </div>
        </div>
      </footer>
      <a className="back-top" href="#top" aria-label="Back to top">
        ↑
      </a>
    </>
  );
}
