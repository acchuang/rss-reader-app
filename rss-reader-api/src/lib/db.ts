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
