if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

import '../config/loadEnv.js';
import { closeSharedDatabasePool, getSharedDatabasePool, runPendingMigrations } from '../infra/database/pool.js';

const run = async () => {
  const pool = await getSharedDatabasePool();
  const { applied, skipped } = await runPendingMigrations(pool);

  if (applied.length > 0) {
    console.info(`Applied migrations: ${applied.join(', ')}`);
  } else {
    console.info('No new migrations to apply.');
  }

  if (skipped.length > 0) {
    console.info(`Skipped migrations (already applied): ${skipped.join(', ')}`);
  }

  await closeSharedDatabasePool();
};

void run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exitCode = 1;
});
