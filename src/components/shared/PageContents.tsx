interface PageContentsProps {
  sections: { id: string; heading: string }[];
}

/** Native disclosure and anchor links work with keyboard input and without JavaScript. */
export default function PageContents({ sections }: PageContentsProps) {
  if (!sections.length) return null;
  return <details className="service-contents">
    <summary>On this page</summary>
    <nav aria-label="Page sections">
      {sections.map(section => <a key={section.id} href={`#${section.id}`}>
        <span>{section.heading}</span><span aria-hidden="true">↗</span>
      </a>)}
    </nav>
  </details>;
}
