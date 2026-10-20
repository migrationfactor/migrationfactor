'use client';

export default function InvoicesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="admin-empty" role="alert">
      <strong>Invoices could not be loaded.</strong>
      <p>Check your connection and try again.</p>
      <button type="button" className="admin-button" onClick={reset}>Try again</button>
    </div>
  );
}
