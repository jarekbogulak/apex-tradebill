if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

import '../config/loadEnv.js';
import { closeSharedDatabasePool, getSharedDatabasePool, runPendingMigrations } from '../infra/database/pool.js';

const run = async () => {
  const pool = await getSharedDatabasePool();
  const { applied, skipped } = await runPendingMigrations(pool);

  if (applied.length > 0) {
    process.stdout.write(`Applied migrations: ${applied.join(', ')}\n`);
  } else {
    process.stdout.write('No new migrations to apply.\n');
  }

  if (skipped.length > 0) {
    process.stdout.write(`Skipped migrations (already applied): ${skipped.join(', ')}\n`);
  }

  await closeSharedDatabasePool();
};

void run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exitCode = 1;
});
