if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

import '../config/loadEnv.js';
import {
  closeSharedDatabasePool,
  getSharedDatabasePool,
} from '../infra/database/pool.js';

const resolveTarget = () => {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    return 'unknown (no SUPABASE_DB_URL or DATABASE_URL set)';
  }

  try {
    const url = new URL(connectionString);
    const database = url.pathname.replace(/^\//, '') || 'postgres';
    const host = url.hostname || 'localhost';
    const port = url.port || '5432';
    return `${host}:${port}/${database}`;
  } catch {
    return 'unknown (connection string could not be parsed as a URL)';
  }
};

const run = async () => {
  const target = resolveTarget();
  process.stdout.write(`Checking database connectivity for ${target} ...\n`);

  const pool = await getSharedDatabasePool();

  try {
    const result = await pool.query<{ ok: number }>('SELECT 1 AS ok;');
    const ok = result.rows[0]?.ok;
    if (ok === 1) {
      process.stdout.write('Database connectivity check succeeded.\n');
    } else {
      console.warn('Database connectivity check returned an unexpected result:', result.rows);
    }
  } finally {
    await closeSharedDatabasePool();
  }
};

void run().catch((error) => {
  console.error('Database connectivity check failed:', error);
  process.exitCode = 1;
});
