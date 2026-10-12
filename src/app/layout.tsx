import type { Metadata } from 'next';
import '@/styles/site.css';
import '@/styles/motion.css';
import '@/styles/restoration.css';
import '@/styles/assessment.css';
import '@/styles/form-controls.css';
import '@/styles/services.css';
import '@/styles/visa-subclasses.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MotionEffect from '@/components/shared/MotionEffect';
import JsonLd from '@/components/shared/JsonLd';
import { organization } from '@/lib/seo';
import { SITE_URL } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    template: '%s | Migration Factor',
    default: 'Visa & Migration Consultancy | Migration Factor',
  },
  description:
    'Migration Factor supports students, professionals and families with migration and visa guidance. Explore services, IELTS/PTE coaching and contact our team.',
  metadataBase: new URL(SITE_URL),
  icons: { icon: { url: '/brand/favicon.png', type: 'image/png', sizes: '64x64' } },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head><link rel="preload" href="/fonts/manrope.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head>
      <body id="top">
        <JsonLd data={organization} />
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'Migration Factor', publisher: { '@id': organization['@id'] } }} />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <MotionEffect />
      </body>
    </html>
  );
}
