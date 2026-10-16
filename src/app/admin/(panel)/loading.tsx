/** Shown straight away when an admin link is clicked, while the page's data loads. */
export default function AdminLoading() {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="admin-skeleton admin-skeleton-title" />
      <div className="admin-skeleton admin-skeleton-bar" />
      <div className="admin-skeleton admin-skeleton-block" />
    </div>
  );
}
