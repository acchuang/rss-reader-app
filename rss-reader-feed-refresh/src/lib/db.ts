import pg from 'pg';

import { getEnv } from './env.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (pool) {
    return pool;
  }

  const env = getEnv();
  if (!env.DATABASE_URL) {
    return null;
  }

  pool = new Pool({
    connectionString: env.DATABASE_URL
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  const current = pool;
  pool = null;
  await current.end();
}
