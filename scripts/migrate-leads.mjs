// Applies supabase/migrations/*.sql once each, in order. Usage: npm run db:migrate
import { Client } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('DIRECT_URL or DATABASE_URL is required.');

// The password may contain characters such as "/" that break URL parsing, so split by hand.
function parseConnection(value) {
  const match = /^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+)(?::(\d+))?\/([^?]+)/.exec(value.trim().replace(/^"|"$/g, ''));
  if (!match) throw new Error('DIRECT_URL is not a valid postgres connection string.');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port || 5432), database };
}

const config = parseConnection(raw);
// db.<ref>.supabase.co is IPv6-only; use the IPv4 session pooler unless SUPABASE_POOLER_HOST overrides it.
const ref = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(config.host)?.[1];
if (ref) {
  config.host = process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-south-1.pooler.supabase.com';
  config.user = `${config.user}.${ref}`;
}

// Supabase signs its database certificates with its own root CA (supabase/prod-ca-2021.crt). Never disable validation.
const ca = await fs.readFile('supabase/prod-ca-2021.crt', 'utf8');
const client = new Client({ ...config, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
await client.connect();
try {
  await client.query('create table if not exists public.migrationfactor_migrations (name text primary key, applied_at timestamptz not null default now())');
  await client.query('alter table public.migrationfactor_migrations enable row level security');
  // The first migration was applied by hand before this log existed; record it rather than replay it.
  const baseline = await client.query("select to_regclass('public.contact_leads') is not null as present");
  if (baseline.rows[0].present) {
    await client.query("insert into public.migrationfactor_migrations(name) values('20261014000000_leads_bookings_admin.sql') on conflict do nothing");
  }
  const files = (await fs.readdir('supabase/migrations')).filter(x => /^\d+.*\.sql$/.test(x)).sort();
  for (const name of files) {
    const exists = await client.query('select name from public.migrationfactor_migrations where name=$1', [name]);
    if (exists.rowCount) { console.log('Already applied: ' + name); continue; }
    await client.query(await fs.readFile(path.join('supabase/migrations', name), 'utf8'));
    await client.query('insert into public.migrationfactor_migrations(name) values($1) on conflict do nothing', [name]);
    console.log('Applied: ' + name);
  }
} finally { await client.end(); }
