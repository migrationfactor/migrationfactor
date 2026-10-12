import Link from 'next/link';
import SectionHeading from '@/components/ui/SectionHeading';
import SiteImage from '@/components/ui/SiteImage';

import { guides } from '@/content/guides';

export default function ArticlesSection() {
  return (
    <section className="section articles-section">
      <div className="container">
        <SectionHeading
          label="BEFORE YOU BEGIN"
          heading={
            <>
              Prepare for the <br />
              conversation ahead.
            </>
          }
        />
        <div className="articles-grid">
          {guides.map((a) => (
            <article
              key={a.slug}
              className="article reveal"
            >
              <Link href={`/guides/${a.slug}/`}>
                <SiteImage slot={a.card.imageSlot} />
              </Link>
              <div className="article-body">
                <span className="eyebrow">PRACTICAL NEXT STEPS</span>
                <h3>
                  <Link href={`/guides/${a.slug}/`}>{a.card.title}</Link>
                </h3>
                <p>{a.card.description}</p>
                <Link className="text-link" href={`/guides/${a.slug}/`}>
                  Read the guide
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
