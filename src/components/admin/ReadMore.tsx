/**
 * Shows the first three lines of a long message with a "Read more" toggle that expands it in place.
 * Uses <details>, so it works without JavaScript and with the keyboard.
 */
export default function ReadMore({ text, limit = 140 }: { text: string | null; limit?: number }) {
  if (!text) return <>—</>;
  if (text.length <= limit && text.split('\n').length <= 3) return <span className="admin-readmore-text">{text}</span>;
  return (
    <details className="admin-readmore">
      <summary><span className="admin-readmore-text">{text}</span><span className="admin-readmore-toggle" aria-hidden="true" /></summary>
    </details>
  );
}
