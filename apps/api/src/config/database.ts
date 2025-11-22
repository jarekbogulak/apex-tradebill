import type { DatabasePoolOptions } from '../adapters/persistence/providers/postgres/pool.js';
import { env } from './env.js';

export const buildDatabasePoolOptions = (): DatabasePoolOptions => {
  const options: DatabasePoolOptions = {
    connectionString: env.database.url ?? undefined,
    min: env.database.pool.min,
    max: env.database.pool.max,
    idleTimeoutMillis: env.database.pool.idleTimeoutMs,
    applicationName: env.database.pool.applicationName,
    connectionTimeoutMillis: 10_000,
  };

  if (env.database.sslMode === 'disable') {
    options.ssl = false;
  } else if (env.database.sslMode === 'require') {
    options.ssl = { rejectUnauthorized: false };
  }

  return options;
};
