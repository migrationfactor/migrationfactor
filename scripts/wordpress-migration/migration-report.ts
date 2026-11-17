import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export type Row = Record<string, string | number | boolean | null | undefined | string[]>;

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(' | ') : v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Row[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

/** Writes <name>.json and <name>.csv; also <name>-failed.csv with only rows that carry an error/mismatch. */
export function writeReport(name: string, rows: Row[], summary: Record<string, unknown>, isFailure: (r: Row) => boolean) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const base = path.join(config.dataDir, name);
  const failed = rows.filter(isFailure);
  fs.writeFileSync(`${base}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), summary: { ...summary, failedRecords: failed.length }, rows }, null, 2));
  fs.writeFileSync(`${base}.csv`, toCsv(rows));
  fs.writeFileSync(`${base}-failed.csv`, failed.length ? toCsv(failed) : 'no failed records\n');
  return { base, failed };
}
