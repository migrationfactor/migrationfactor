'use client';

import React, { useEffect, useState } from 'react';
import SectionHeading from '@/components/ui/SectionHeading';
import Button from '@/components/ui/Button';
import SiteImage from '@/components/ui/SiteImage';
import Flag from '@/components/ui/Flag';
import { countries } from '@/content/countries';

const flags: Record<string, string> = {
  AU: 'flagAustralia',
  GB: 'flagUK',
  CA: 'flagCanada',
};

export default function CountrySection() {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  useEffect(() => {
    const selectHash = () => {
      const index = countries.findIndex(country => location.hash === `#country-${country.code}`);
      if (index >= 0) setSelectedIndex(index);
    };
    selectHash();
    window.addEventListener('hashchange', selectHash);
    return () => window.removeEventListener('hashchange', selectHash);
  }, []);

  return (
    <section className="section countries-section">
      <div className="container">
        <SectionHeading
          label="EXPLORE DESTINATIONS"
          heading={
            <>
              Where could your <br />
              next chapter begin?
            </>
          }
        />
        <div className="country-selector">
          {countries.map((c, i) => {
            const isSelected = selectedIndex === i;
            return (
              <div
                key={c.code}
                id={`country-${c.code}`}
                className={`country-row ${isSelected ? 'selected' : ''}`}
              >
                <button
                  className="country-toggle"
                  type="button"
                  aria-expanded={isSelected}
                  aria-controls={`country-panel-${c.code}`}
                  onClick={() => setSelectedIndex(i)}
                  onMouseEnter={() => {
                    if (window.matchMedia('(hover: hover)').matches) setSelectedIndex(i);
                  }}
                  onFocus={() => setSelectedIndex(i)}
                >
                  <span>
                    {c.name}
                    <small>{c.code === 'EU' ? 'REGION' : 'DESTINATION'}</small>
                  </span>
                  <span className="country-flag" aria-hidden="true">
                    {flags[c.code] ? (
                      <SiteImage slot={flags[c.code]} />
                    ) : (
                      <Flag code={c.code} />
                    )}
                  </span>
                  <span className="country-plus" aria-hidden="true">
                    +
                  </span>
                </button>
                <div
                  className="country-panel"
                  id={`country-panel-${c.code}`}
                  hidden={!isSelected}
                >
                  <h3>{c.name}</h3>
                  <p>{c.text}</p>
                  <Button text={c.detail} href={c.href} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="country-note">
          Destinations mentioned in the company report. Discuss current service availability with the team.
        </p>
      </div>
    </section>
  );
}
