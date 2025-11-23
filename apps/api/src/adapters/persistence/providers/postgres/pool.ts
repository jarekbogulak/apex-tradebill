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

export const buildPgPoolConfig = ({
  connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL,
  min = parseInteger(process.env.SUPABASE_DB_POOL_MIN, 0),
  max = parseInteger(process.env.SUPABASE_DB_POOL_MAX, 10),
  idleTimeoutMillis = parseInteger(process.env.SUPABASE_DB_IDLE_TIMEOUT_MS, 30_000),
  connectionTimeoutMillis,
  ssl,
  applicationName = process.env.SUPABASE_DB_APPLICATION ?? 'apex-tradebill-api',
}: DatabasePoolOptions = {}): PgPoolConfig & { connectionString: string } => {
  if (!connectionString) {
    throw new Error(
      'Missing SUPABASE_DB_URL (or DATABASE_URL) environment variable for PostgreSQL connection.',
    );
  }

  return {
    connectionString,
    min,
    max,
    idleTimeoutMillis,
    allowExitOnIdle: true,
    connectionTimeoutMillis,
    application_name: applicationName,
    ssl: resolveSslConfig(connectionString, ssl),
  };
};

export const createDatabasePool = async (
  options: DatabasePoolOptions = {},
): Promise<DatabasePool> => {
  const { Pool } = await loadPgModule();
  const pool = new Pool(buildPgPoolConfig(options));

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
