/** Marks a lead nobody has opened yet; clears once its detail page is viewed. */
export default function UnreadDot({ viewedAt }: { viewedAt: string | null }) {
  if (viewedAt) return null;
  return <span className="admin-unread-dot" title="Not opened yet"><span className="sr-only">Not opened yet: </span></span>;
}
