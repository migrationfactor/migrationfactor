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
  if (rows.length === 0) return <p className="admin-empty">{empty}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>
                  {c.render ? c.render(row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="admin-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="admin-tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`seo-tab${active === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}
