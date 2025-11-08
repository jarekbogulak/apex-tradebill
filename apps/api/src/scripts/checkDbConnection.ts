import { buildDatabasePoolOptions } from '../config/database.js';
import { env } from '../config/env.js';
import { closeSharedDatabasePool, getSharedDatabasePool } from '../infra/database/pool.js';

const resolveTarget = () => {
  const connectionString = env.database.url;
  if (!connectionString) {
    return 'in-memory (APEX_ALLOW_IN_MEMORY_DB=true)';
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

  const pool = await getSharedDatabasePool(buildDatabasePoolOptions());

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
