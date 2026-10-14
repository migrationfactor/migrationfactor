import { statusLabel } from './format';

interface FiltersProps {
  q?: string;
  status?: string;
  statuses: readonly string[];
  extra?: { name: string; label: string; value?: string; options: [string, string][] };
}

/** Plain GET form so filters work without JavaScript and stay in the URL. */
export default function Filters({ q, status, statuses, extra }: FiltersProps) {
  return (
    <form className="admin-filters" method="get" role="search">
      <label>Search<input type="search" name="q" defaultValue={q} maxLength={80} placeholder="Name, email or phone" /></label>
      <label>Status<select name="status" defaultValue={status || ''}>
        <option value="">All statuses</option>
        {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
      </select></label>
      {extra && <label>{extra.label}<select name={extra.name} defaultValue={extra.value || ''}>
        {extra.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>}
      <button type="submit" className="admin-button">Apply</button>
    </form>
  );
}
