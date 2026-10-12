'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { company } from '@/content/company';

import { missionVisionSlides as slides } from '@/content/about';

export default function SupportSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (paused || reduced || hovered || focused) return;
    const timer = setInterval(() => setActive(i => (i + 1) % slides.length), 3000);
    return () => clearInterval(timer);
  }, [paused, reduced, hovered, focused]);

  return (
    <section className="section support-section" aria-roledescription="carousel" aria-label="Migration Factor mission and vision"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="container support-content reveal">
        <div className="support-orbits" aria-hidden="true">
          {['portraitProThree', 'portraitProFour', 'portraitProFive', 'portraitProSix'].map(name =>
            <Image key={name} src={`/media/${name}.webp`} alt="" width={100} height={100} />)}
        </div>
        <div className="support-mark" aria-hidden="true"><Image src={`/media/${slides[active].photo}.webp`} alt="" width={200} height={200} /></div>
        <div className="support-slides" aria-live={paused || reduced || focused ? 'polite' : 'off'}>
          {slides.map((slide, i) => <article key={slide.label} className={`support-slide${i === active ? ' active' : ''}`} aria-hidden={i !== active}>
            <span className="eyebrow">{slide.label}</span>
            <h3>{slide.title}</h3><p>{slide.text}</p><strong>{company.name}</strong>
          </article>)}
        </div>
        <div className="support-controls">
          {slides.map((slide, i) => <button key={slide.label} type="button" aria-label={`Show ${slide.label.toLowerCase()}`} aria-pressed={active === i} onClick={() => setActive(i)} />)}
          <button className="support-pause" type="button" aria-label={paused ? 'Play slides' : 'Pause slides'} onClick={() => setPaused(value => !value)}>{paused ? '▶' : 'Ⅱ'}</button>
        </div>
      </div>
    </section>
  );
}
