'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { company } from '@/content/company';
import { navigation } from '@/content/navigation';
import { services } from '@/content/services';
import { countries } from '@/content/countries';
import { initSiteHeader } from './header-client';

function HeaderLogo({ drawer = false }: { drawer?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Migration Factor home">
      <Image className="brand-mark" src={drawer ? '/brand/favicon.png' : '/brand/mark.webp'}
        width={200} height={200} sizes={drawer ? "80px" : "92px"} loading={drawer ? "lazy" : "eager"} alt="" decoding="async" />
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const menus: Record<string, [string, string][]> = {
    Home: [['Homepage', '/'], ['Explore services', '/services/'], ['Contact our team', '/contact/'], ['Free consultation', '/consultation']],
    About: [['Company profile', '/about/'], ['Frequently asked questions', '/faq/'], ['IELTS Coaching', '/coaching/ielts/'], ['PTE Coaching', '/coaching/pte/']],
    Countries: countries.map(country => [country.name, `/countries/#country-${country.code}`]),
    Services: services.map(service => [service.name, `/services/${service.slug}/`]),
    Guides: [['Preparing your profile', '/guides/preparing-your-profile/'], ['Document checklist', '/guides/document-checklist/'], ['Migration tools', '/tools']],
  };
  const headerNavigation: [string, string][] = [
    ['Home', '/'], ['About', '/about/'], ['Countries', '/countries/'],
    ['Services', '/services/'], ['Guides', '/guides/preparing-your-profile/'], ['Contact', '/contact/'],
  ];

  useEffect(() => initSiteHeader(), [pathname]);

  function current(url: string): 'page' | 'true' | undefined {
    const route = url === '/' ? '/' : url.replace(/\/$/, '');
    if (pathname === route) return 'page';
    if (route !== '/' && pathname.startsWith(`${route}/`)) return 'true';
    if (url.startsWith('/guides/') && pathname.startsWith('/guides/')) return 'true';
    return undefined;
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="topbar"><div className="container">
        <a href={`mailto:${company.email}`}><Icon type="mail" />{company.email}</a>
        <span><Icon type="clock" />{company.hours}</span>
        <span className="top-location">Perth &amp; Melbourne, Australia</span>
        <a className="topbar-phone" href={`tel:${company.tel}`}><Icon type="phone" />{company.phone}</a>
      </div></div>
      <header className="header" id="header"><div className="nav-shell container">
        <HeaderLogo />
        <nav id="primary-nav" aria-label="Main navigation">
          {headerNavigation.map(([name, url]) => {
            const menu = menus[name];
            if (!menu) return <Link key={url} href={url} aria-current={current(url)}>{name}</Link>;
            const id = `nav-${name.toLowerCase()}`;
            return (
              <div className="nav-item" key={url}><div className="nav-item-label">
                <Link href={url} aria-current={current(url)}>{name}</Link>
                <button className="nav-dropdown-toggle" type="button" aria-label={`Open ${name} menu`}
                  aria-expanded="false" aria-controls={id}><span className="nav-chevron" aria-hidden="true" /></button>
              </div><div className="nav-submenu" id={id} hidden>
                {menu.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
              </div></div>
            );
          })}
        </nav>
        <div className="header-actions">
          <a className="header-phone" href={`tel:${company.tel}`}>
            <span className="header-phone-icon" aria-hidden="true" />
            <span><small>Talk to our team</small><strong>{company.phone}</strong></span>
          </a>
          <button className="menu-toggle" type="button" aria-controls="contact-drawer" aria-haspopup="dialog" aria-expanded="false">
            <span className="hamburger" aria-hidden="true" /><span className="sr-only">Open menu and contact details</span>
          </button>
        </div>
      </div></header>
      <dialog className="contact-drawer" id="contact-drawer" aria-labelledby="drawer-title">
        <div className="drawer-heading">
          <HeaderLogo drawer /><h2 className="sr-only" id="drawer-title">Migration Factor contact details</h2>
          <form method="dialog"><button className="drawer-close" type="submit" aria-label="Close menu and contact details">×</button></form>
        </div>
        <div className="drawer-body">
          <div className="drawer-navigation" role="navigation" aria-label="Mobile navigation">
            {navigation.map(([name, url]) => <Link key={url} href={url} aria-current={current(url)}>{name}</Link>)}
            <Link href="/guides/preparing-your-profile/">Preparing your profile</Link>
            <Link href="/guides/document-checklist/">Document checklist</Link>
            <Link href="/tools">Migration tools</Link>
            <Link href="/consultation">Free consultation</Link>
          </div>
          <p>{company.overview}</p>
          <div className="drawer-contact">
            <h3>Our offices</h3>{company.offices.map(office => <p key={office}>{office}</p>)}
            <h3>Email</h3><a href={`mailto:${company.email}`}>{company.email}</a>
            <h3>Call our team</h3><a href={`tel:${company.tel}`}>{company.phone}</a>
            <p className="drawer-hours">{company.hours}</p>
          </div>
          <Link className="button" href="/contact/"><span>Request an eligibility assessment</span></Link>
        </div>
      </dialog>
    </>
  );
}
