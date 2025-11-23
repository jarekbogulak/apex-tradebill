import { env } from '../config/env.js';
import { buildDatabasePoolOptions } from '../config/database.js';
import { runMigrations } from '../adapters/persistence/providers/postgres/migrations.js';

const run = async () => {
  if (!env.database.url) {
    if (env.database.allowInMemory) {
      console.warn(
        'APEX_ALLOW_IN_MEMORY_DB is enabled and no database URL is configured; skipping migrations.',
      );
      return;
    }
    throw new Error(
      'Database URL is missing. Set SUPABASE_DB_URL (or DATABASE_URL) or enable APEX_ALLOW_IN_MEMORY_DB.',
    );
  }

  if (env.database.allowInMemory && process.env.APEX_FORCE_DB_MIGRATIONS !== 'true') {
    console.warn(
      'APEX_ALLOW_IN_MEMORY_DB is enabled; skipping migrations. Set APEX_FORCE_DB_MIGRATIONS=true to force execution.',
    );
    return;
  }

  await runMigrations(buildDatabasePoolOptions(), console);
  process.stdout.write('Migrations finished.\n');
};

void run().catch((error) => {
  console.error('Migration run failed:', error);
  process.exitCode = 1;
});
