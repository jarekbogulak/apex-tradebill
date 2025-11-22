import { promises as fs } from 'node:fs';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PgPool = {
  new (config?: PgPoolConfig): DatabasePool;
};

interface PgPoolConfig {
  connectionString?: string;
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  allowExitOnIdle?: boolean;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  application_name?: string;
}

export interface QueryResultRow {
  [column: string]: unknown;
}

export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  release(error?: Error): void;
}

export interface DatabasePool {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  connect(): Promise<DatabaseClient>;
  end(): Promise<void>;
  on(event: 'error', listener: (error: Error) => void): void;
}

export interface DatabasePoolOptions {
  connectionString?: string;
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  applicationName?: string;
}

const loadPgModule = async (): Promise<{ Pool: PgPool }> => {
  const module = (await import('pg')) as unknown;
  if (!module || typeof module !== 'object' || !('Pool' in module)) {
    throw new Error('pg module not available. Did you install the "pg" package?');
  }
  return module as { Pool: PgPool };
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveSslConfig = (
  connectionString: string,
  explicit: DatabasePoolOptions['ssl'],
): DatabasePoolOptions['ssl'] => {
  if (typeof explicit !== 'undefined') {
    return explicit;
  }

  if (process.env.SUPABASE_DB_SSL === 'disable') {
    return false;
  }

  if (connectionString.includes('supabase.co') || process.env.SUPABASE_DB_SSL === 'require') {
    return {
      rejectUnauthorized: false,
    };
  }

  return undefined;
};

export const createDatabasePool = async ({
  connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL,
  min = parseInteger(process.env.SUPABASE_DB_POOL_MIN, 0),
  max = parseInteger(process.env.SUPABASE_DB_POOL_MAX, 10),
  idleTimeoutMillis = parseInteger(process.env.SUPABASE_DB_IDLE_TIMEOUT_MS, 30_000),
  connectionTimeoutMillis,
  ssl,
  applicationName = process.env.SUPABASE_DB_APPLICATION ?? 'apex-tradebill-api',
}: DatabasePoolOptions = {}): Promise<DatabasePool> => {
  if (!connectionString) {
    throw new Error(
      'Missing SUPABASE_DB_URL (or DATABASE_URL) environment variable for PostgreSQL connection.',
    );
  }

  const { Pool } = await loadPgModule();
  const pool = new Pool({
    connectionString,
    min,
    max,
    idleTimeoutMillis,
    allowExitOnIdle: true,
    connectionTimeoutMillis,
    application_name: applicationName,
    ssl: resolveSslConfig(connectionString, ssl),
  });

  pool.on('error', (error: Error) => {
    console.error('Unexpected PostgreSQL client error', error);
  });

  return pool;
};

let sharedPool: DatabasePool | null = null;

export const getSharedDatabasePool = async (
  options?: DatabasePoolOptions,
): Promise<DatabasePool> => {
  if (!sharedPool) {
    sharedPool = await createDatabasePool(options);
  }
  return sharedPool;
};

export const closeSharedDatabasePool = async (): Promise<void> => {
  if (!sharedPool) {
    return;
  }
  await sharedPool.end();
  sharedPool = null;
};

const MIGRATIONS_TABLE = 'schema_migrations';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

const defaultMigrationsDir = (): string => {
  const url = new URL('../../../../../configs/db/migrations', import.meta.url);
  return fileURLToPath(url);
};

const listMigrationFiles = async (directory: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const directoryExists = async (directory: string): Promise<boolean> => {
  try {
    await fs.access(directory, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const runPendingMigrations = async (
  pool: DatabasePool,
  directory = defaultMigrationsDir(),
): Promise<MigrationResult> => {
  if (!(await directoryExists(directory))) {
    return { applied: [], skipped: [] };
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
  );

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM ${MIGRATIONS_TABLE} ORDER BY applied_at ASC;`,
  );
  const appliedIds = new Set(existing.rows.map((row) => row.id));

  const files = await listMigrationFiles(directory);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const fileName of files) {
    const migrationId = fileName.replace(/\.sql$/, '');
    if (appliedIds.has(migrationId)) {
      skipped.push(migrationId);
      continue;
    }

    const filePath = path.join(directory, fileName);
    const sql = await fs.readFile(filePath, 'utf-8');
    const trimmed = sql.trim();
    if (!trimmed) {
      skipped.push(migrationId);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(trimmed);
      await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (id) VALUES ($1);`, [migrationId]);
      await client.query('COMMIT;');
      applied.push(migrationId);
    } catch (error) {
      await client.query('ROLLBACK;');
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to apply migration "${fileName}": ${message}`);
    } finally {
      client.release();
    }
  }

  return { applied, skipped };
};

export const withTransaction = async <T>(
  pool: DatabasePool,
  handler: (client: DatabaseClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    const result = await handler(client);
    await client.query('COMMIT;');
    return result;
  } catch (error) {
    await client.query('ROLLBACK;');
    throw error;
  } finally {
    client.release();
  }
};
