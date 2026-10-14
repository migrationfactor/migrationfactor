'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { company } from '@/content/company';
import { navigation } from '@/content/navigation';
import { services } from '@/content/services';
import { serviceNavigation } from '@/content/service-navigation';
import PhoneWhatsApp from '@/components/shared/PhoneWhatsApp';
import { initSiteHeader } from './header-client';
import '@/styles/service-navigation.css';

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
    Home: [['Homepage', '/'], ['Explore services', '/services/'], ['Contact our team', '/contact/'], ['Book a consultation', '/consultation']],
    Services: services.map(service => [service.name, `/services/${service.slug}/`]),
  };

  useEffect(() => initSiteHeader(), [pathname]);

  function current(url: string): 'page' | 'true' | undefined {
    const route = url === '/' ? '/' : url.replace(/\/$/, '');
    if (pathname === route) return 'page';
    if (route !== '/' && pathname.startsWith(`${route}/`)) return 'true';
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
        <Link className="topbar-booking" href="/consultation" aria-current={current('/consultation')}><Icon type="calendar" /><span>Book consultation</span></Link>
      </div></div>
      <header className="header" id="header"><div className="nav-shell container">
        <HeaderLogo />
        <nav id="primary-nav" aria-label="Main navigation">
          {navigation.map(([name, url]) => {
            const menu = menus[name];
            if (!menu) return <Link key={url} href={url} aria-current={current(url)}>{name}</Link>;
            const id = `nav-${name.toLowerCase()}`;
            return (
              <div className="nav-item" key={url}><div className="nav-item-label">
                <Link href={url} aria-current={current(url)}>{name}</Link>
                <button className="nav-dropdown-toggle" type="button" aria-label={`Open ${name} menu`}
                  aria-expanded="false" aria-controls={id}><span className="nav-chevron" aria-hidden="true" /></button>
              </div><div className="nav-submenu" id={id} hidden>
                {name === 'Services' ? serviceNavigation.map(service => <div className="nav-service-item" key={service.slug} data-service={service.slug}>
                  <div className="nav-service-row">
                    <Link href={service.href} aria-current={current(service.href)}>{service.label}</Link>
                    {service.children.length > 0 && <button className="service-submenu-toggle" type="button" aria-label={`Open ${service.label} subclasses`} aria-expanded="false" aria-controls={`subclasses-${service.slug}`}><span className="nav-chevron" aria-hidden="true" /></button>}
                  </div>
                  {service.children.length > 0 && <div className="service-submenu" id={`subclasses-${service.slug}`} hidden>
                    {service.children.map(child => <Link href={child.href} key={child.href} aria-current={current(child.href)}>{child.label}</Link>)}
                  </div>}
                </div>) : menu.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
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
            {navigation.map(([name, url]) => name !== 'Services' ? <Link key={url} href={url} aria-current={current(url)}>{name}</Link> : <details className="drawer-services" key={url}>
              <summary>Services<span className="nav-chevron" aria-hidden="true" /></summary>
              <Link href={url}>All services</Link>
              {serviceNavigation.map(service => service.children.length ? <details className="drawer-service-item" key={service.slug}>
                <summary>{service.label}<span className="nav-chevron" aria-hidden="true" /></summary>
                <div className="drawer-subclass-links"><Link href={service.href}>{service.label} overview</Link>{service.children.map(child => <Link key={child.href} href={child.href} aria-current={current(child.href)}>{child.label}</Link>)}</div>
              </details> : <Link key={service.slug} href={service.href}>{service.label}</Link>)}
            </details>)}
          </div>
          <p>{company.overview}</p>
          <div className="drawer-contact">
            <h3>Our offices</h3>{company.offices.map(office => <p key={office}>{office}</p>)}
            <h3>Email</h3><a href={`mailto:${company.email}`}>{company.email}</a>
            <h3>Call or WhatsApp</h3><PhoneWhatsApp />
            <p className="drawer-hours">{company.hours}</p>
          </div>
          <Link className="button" href="/contact/"><span>Request an eligibility assessment</span></Link>
        </div>
      </dialog>
    </>
  );
}
