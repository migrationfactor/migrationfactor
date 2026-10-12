import Link from 'next/link';
import SectionHeading from '@/components/ui/SectionHeading';
import BrandIcon from '@/components/ui/BrandIcon';
import Icon from '@/components/ui/Icon';
import { coachingCardGroups, type CoachingCard } from '@/content/coaching';

function Cards({ items }: { items: CoachingCard[] }) {
  return <div className="coaching-card-group">{items.map(([label, slug, symbol]) =>
    <Link className="coaching-card reveal" href={`/coaching/${slug}/`} key={label}>
      {symbol === 'coachingIELTS' || symbol === 'coachingPTE' ? <BrandIcon slot={symbol} /> : <Icon type={symbol} />}
      <h3>{label}</h3>
    </Link>
  )}</div>;
}

// Preserve the approved eight-card composition from the live static website.
export default function CoachingSection() {
  return <section className="section coaching-section" id="coaching"><div className="container">
    <SectionHeading label="IELTS & PTE COACHING" heading={<>Prepare for your<br />English language test.</>} />
    <div className="coaching-programs">
      <Cards items={coachingCardGroups[0]} />
      <div className="coaching-banner reveal"><h3>Migration Factor</h3>
        <div className="coaching-badge"><span>IELTS</span><span>PTE</span></div>
        <p>ONLINE CLASSES.<br />PERSONALIZED PREPARATION.</p>
      </div>
      <Cards items={coachingCardGroups[1]} />
    </div>
  </div></section>;
}
