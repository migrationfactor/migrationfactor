if (typeof window !== 'undefined') {
  throw new Error('This module can only be used on the server.');
}
import { Pool, PoolClient } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

let poolInstance: Pool | null = null;

function parseConnection(value: string) {
  const match = /^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+)(?::(\d+))?\/([^?]+)/.exec(value.trim().replace(/^"|"$/g, ''));
  if (!match) throw new Error('DATABASE_URL or DIRECT_URL is not a valid postgres connection string.');
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port || 5432), database };
}

export function getDbPool(): Pool {
  if (poolInstance) return poolInstance;
  const raw = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DIRECT_URL or DATABASE_URL must be configured in environment.');
  }

  const config = parseConnection(raw);
  const ref = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(config.host)?.[1];
  if (ref) {
    config.host = process.env.SUPABASE_POOLER_HOST || 'aws-0-ap-south-1.pooler.supabase.com';
    config.user = `${config.user}.${ref}`;
  }

  let sslConfig: unknown = { rejectUnauthorized: false };
  const caPath = path.resolve(process.cwd(), 'supabase/prod-ca-2021.crt');
  if (fs.existsSync(caPath)) {
    const ca = fs.readFileSync(caPath, 'utf8');
    sslConfig = { ca, rejectUnauthorized: true };
  }

  poolInstance = new Pool({
    ...config,
    ssl: sslConfig as any,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return poolInstance;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getDbPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const withTransaction = transaction;

