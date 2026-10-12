import React from 'react';
import SectionHeading from '@/components/ui/SectionHeading';
import Button from '@/components/ui/Button';
import { faqs } from '@/content/faqs';

export default function FaqSection() {
  return (
    <section className="section">
      <div className="container faq-layout">
        <div>
          <SectionHeading
            label="YOUR QUESTIONS"
            heading={
              <>
                A clearer start <br />
                to your journey.
              </>
            }
            center={false}
          />
          <p>Information from our company report, organized around your next steps.</p>
          <Button text="Speak with our team" href="/contact/" />
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
