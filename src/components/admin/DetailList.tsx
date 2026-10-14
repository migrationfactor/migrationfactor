export default function DetailList({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="admin-dl">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
