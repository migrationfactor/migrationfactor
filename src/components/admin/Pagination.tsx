import Link from 'next/link';
import { PAGE_SIZE } from '@/lib/admin/queries';

export default function Pagination({ page, count, params }: { page: number; count: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const href = (target: number) => {
    const search = new URLSearchParams(Object.entries({ ...params, page: String(target) }).filter(([, v]) => v) as [string, string][]);
    return `?${search.toString()}`;
  };
  return (
    <nav className="admin-pagination" aria-label="Pagination">
      <span>{count} record{count === 1 ? '' : 's'} · Page {Math.min(page, pages)} of {pages}</span>
      {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
      {page < pages && <Link href={href(page + 1)}>Next →</Link>}
    </nav>
  );
}
