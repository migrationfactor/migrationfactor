'use client';

import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

const cell: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '0.8125rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' };

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
    <div style={{ background: '#ffffff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0fdfa' }}>
            {columns.map((c) => (
              <th key={c.key} style={{ ...cell, fontWeight: 700, color: '#042628' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ ...cell, color: '#64748b', textAlign: 'center', padding: 28 }}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} style={cell}>
                    {c.render ? c.render(row) : String(row[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#042628', margin: '0 0 4px' }}>{title}</h1>
      <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; active: string; onChange: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid ' + (active === t.id ? '#0b666a' : '#d1d5db'),
            background: active === t.id ? '#0b666a' : '#ffffff',
            color: active === t.id ? '#ffffff' : '#042628',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: 'pointer',
          }}
        >
          {t.label}
          {t.count !== undefined ? ` (${t.count})` : ''}
        </button>
      ))}
    </div>
  );
}
