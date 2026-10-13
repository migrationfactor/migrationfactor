import Link from 'next/link';
import type { toolContent } from '@/content/tools';

type Content = typeof toolContent[keyof typeof toolContent];

export function ToolIntro({ content }: { content: Content }) {
  return <header className="tool-intro">
    <h2>{content.introHeading}</h2>
    <p>{content.intro}</p>
  </header>;
}

export function ToolGuide({ content }: { content: Content }) {
  return <div className="tool-guide">
    <div className="tool-guide-grid">
      <section aria-labelledby="tool-how-title">
        <h2 id="tool-how-title">{content.howHeading}</h2>
        <ol>{content.steps.map(step => <li key={step}>{step}</li>)}</ol>
      </section>
      <section aria-labelledby="tool-understand-title">
        <h2 id="tool-understand-title">{content.resultHeading}</h2>
        <p>{content.result}</p>
      </section>
    </div>
    <section className="tool-related" aria-labelledby="tool-related-title">
      <h2 id="tool-related-title">Related tools and visa guidance</h2>
      <ul>{content.related.map(link => <li key={link.href}><Link href={link.href}>{link.label}<span aria-hidden="true"> ↗</span></Link></li>)}</ul>
      <Link href="/tools">Explore all Australian migration tools</Link>
    </section>
  </div>;
}
