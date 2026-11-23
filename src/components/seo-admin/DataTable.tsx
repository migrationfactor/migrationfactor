'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  empty: string;
}) {
  return (
    <table className="wp-list-table widefat striped">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="no-items"><td colSpan={columns.length}>{empty}</td></tr>
        ) : (
          rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="wp-heading-inline">{title}</h1>
      <hr className="wp-header-end" />
      <p className="sa-subtitle">{subtitle}</p>
    </>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; active: string; onChange: (id: string) => void }) {
  return (
    <ul className="subsubsub" role="tablist">
      {tabs.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={active === t.id ? 'current' : undefined}
            onClick={() => onChange(t.id)}
          >
            {t.label}
            {t.count !== undefined ? <span className="count"> ({t.count})</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
