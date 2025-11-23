import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RunnerOption } from 'node-pg-migrate';
import type { DatabasePoolOptions } from './pool.js';
import { buildPgPoolConfig, createDatabasePool } from './pool.js';

const MIGRATIONS_TABLE = 'pgmigrations';
const LEGACY_MIGRATIONS_TABLE = 'schema_migrations';

type MigrationLogger = Pick<Console, 'info' | 'warn' | 'error'>;

const normalizeMigrationName = (name: string): string => {
  const [prefix, rest] = name.split('__');
  if (!prefix) {
    return name;
  }

  // Legacy format: YYYYMMDDTHHMMSS__description
  if (/^\d{8}T\d{6}$/.test(prefix)) {
    const normalizedPrefix = `${prefix.replace('T', '')}000`;
    return rest ? `${normalizedPrefix}__${rest}` : normalizedPrefix;
  }

  // Legacy format without milliseconds: YYYYMMDDHHMMSS__description
  if (/^\d{14}$/.test(prefix)) {
    const normalizedPrefix = `${prefix}000`;
    return rest ? `${normalizedPrefix}__${rest}` : normalizedPrefix;
  }

  return name;
};

const defaultMigrationsDir = (): string => {
  const thisDir = fileURLToPath(new URL('.', import.meta.url));
  return path.resolve(thisDir, '../../../../../../../configs/db/migrations');
};

const loadPgMigrateRunner = async (): Promise<(options: RunnerOption) => Promise<unknown>> => {
  const module = (await import('node-pg-migrate')) as unknown as {
    default?: unknown;
    run?: unknown;
    runner?: unknown;
  };

  const candidates = [
    module,
    module.default,
    (module.default as { default?: unknown } | undefined)?.default,
    (module.default as { run?: unknown; runner?: unknown } | undefined)?.run,
    (module.default as { run?: unknown; runner?: unknown } | undefined)?.runner,
    module.run,
    module.runner,
  ];

  const candidate = candidates.find((value) => typeof value === 'function') ?? null;

  if (typeof candidate !== 'function') {
    throw new Error('node-pg-migrate runner not available. Did you install the dependency?');
  }

  return candidate as (options: RunnerOption) => Promise<unknown>;
};

const copyLegacyMigrations = async (
  options: DatabasePoolOptions,
  logger: MigrationLogger,
): Promise<void> => {
  const pool = await createDatabasePool(options);
  const client = await pool.connect();

  try {
    await client.query('BEGIN;');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        run_on TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Normalize any previously inserted migration names to the timestamp format node-pg-migrate expects.
    const existingRows = await client.query<{ name: string; run_on: Date }>(
      `SELECT name, run_on FROM ${MIGRATIONS_TABLE};`,
    );
    for (const { name, run_on } of existingRows.rows) {
      const normalizedName = normalizeMigrationName(name);
      if (normalizedName !== name) {
        await client.query(
          `
            INSERT INTO ${MIGRATIONS_TABLE} (name, run_on)
            VALUES ($1, $2)
            ON CONFLICT (name) DO NOTHING;
          `,
          [normalizedName, run_on],
        );
        await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1;`, [name]);
      }
    }

    const legacyTableExists = await client.query<{ exists: string | null }>(
      `SELECT to_regclass($1) AS exists;`,
      [`public.${LEGACY_MIGRATIONS_TABLE}`],
    );

    if (legacyTableExists.rows[0]?.exists) {
      const legacyRows = await client.query<{ id: string }>(
        `SELECT id FROM ${LEGACY_MIGRATIONS_TABLE};`,
      );
      for (const { id } of legacyRows.rows) {
        const normalizedName = normalizeMigrationName(id);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;`,
          [normalizedName],
        );
      }
      if (legacyRows.rowCount > 0) {
        logger.info?.(`Seeded ${legacyRows.rowCount} legacy migrations into ${MIGRATIONS_TABLE}.`);
      }
    }

    await client.query('COMMIT;');
  } catch (error) {
    await client.query('ROLLBACK;');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

export const runMigrations = async (
  options: DatabasePoolOptions = {},
  logger: MigrationLogger = console,
  migrationsDir = defaultMigrationsDir(),
): Promise<void> => {
  const poolConfig = buildPgPoolConfig(options);

  await copyLegacyMigrations(
    {
      connectionString: poolConfig.connectionString,
      ssl: poolConfig.ssl,
    },
    logger,
  );

  const runnerOptions: RunnerOption = {
    databaseUrl: {
      connectionString: poolConfig.connectionString,
      ssl: poolConfig.ssl,
    },
    // Explicitly ignore README and other Markdown/dotfiles so node-pg-migrate doesn't try to load them.
    ignorePattern: '(?:\\..*|.*\\.md)',
    dir: migrationsDir,
    direction: 'up',
    checkOrder: true,
    createSchema: true,
    migrationsTable: MIGRATIONS_TABLE,
    migrationsSchema: 'public',
    logger,
    noLock: false,
  };

  const runner = await loadPgMigrateRunner();
  await runner(runnerOptions);
};
