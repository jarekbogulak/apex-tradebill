import type { DatabaseClient, DatabasePool } from '../pool.js';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- need module function signatures for manual loader
type PoolModule = typeof import('../pool.js');

let createDatabasePool: PoolModule['createDatabasePool'];
let closeSharedDatabasePool: PoolModule['closeSharedDatabasePool'];
let withTransaction: PoolModule['withTransaction'];
let getSharedDatabasePool: PoolModule['getSharedDatabasePool'];

beforeAll(async () => {
  const module = await import('../pool.js');
  createDatabasePool = module.createDatabasePool;
  closeSharedDatabasePool = module.closeSharedDatabasePool;
  withTransaction = module.withTransaction;
  getSharedDatabasePool = module.getSharedDatabasePool;
});

const mockPoolConfigs: unknown[] = [];
const mockPoolInstances: Array<{
  query: jest.Mock;
  connect: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
}> = [];

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation((config: unknown) => {
      mockPoolConfigs.push(config);
      const instance = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn(),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };
      mockPoolInstances.push(instance);
      return instance;
    }),
  };
});

const resetPoolMocks = () => {
  mockPoolConfigs.length = 0;
  mockPoolInstances.length = 0;
  jest.clearAllMocks();
};

const restoreEnv = (key: string, original: string | undefined) => {
  if (typeof original === 'undefined') {
    delete process.env[key];
  } else {
    process.env[key] = original;
  }
};

describe('createDatabasePool', () => {
  const originalEnv = {
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_DB_POOL_MIN: process.env.SUPABASE_DB_POOL_MIN,
    SUPABASE_DB_POOL_MAX: process.env.SUPABASE_DB_POOL_MAX,
    SUPABASE_DB_IDLE_TIMEOUT_MS: process.env.SUPABASE_DB_IDLE_TIMEOUT_MS,
    SUPABASE_DB_APPLICATION: process.env.SUPABASE_DB_APPLICATION,
    SUPABASE_DB_SSL: process.env.SUPABASE_DB_SSL,
  };

  afterEach(async () => {
    resetPoolMocks();
    await closeSharedDatabasePool();
    restoreEnv('SUPABASE_DB_URL', originalEnv.SUPABASE_DB_URL);
    restoreEnv('DATABASE_URL', originalEnv.DATABASE_URL);
    restoreEnv('SUPABASE_DB_POOL_MIN', originalEnv.SUPABASE_DB_POOL_MIN);
    restoreEnv('SUPABASE_DB_POOL_MAX', originalEnv.SUPABASE_DB_POOL_MAX);
    restoreEnv('SUPABASE_DB_IDLE_TIMEOUT_MS', originalEnv.SUPABASE_DB_IDLE_TIMEOUT_MS);
    restoreEnv('SUPABASE_DB_APPLICATION', originalEnv.SUPABASE_DB_APPLICATION);
    restoreEnv('SUPABASE_DB_SSL', originalEnv.SUPABASE_DB_SSL);
  });

  it('throws when no connection string is provided', async () => {
    delete process.env.SUPABASE_DB_URL;
    delete process.env.DATABASE_URL;

    await expect(createDatabasePool()).rejects.toThrow(
      'Missing SUPABASE_DB_URL (or DATABASE_URL) environment variable for PostgreSQL connection.',
    );
  });

  it('configures the pg pool with defaults derived from env', async () => {
    process.env.SUPABASE_DB_URL = 'postgres://user:pass@db.supabase.co:5432/apex?sslmode=require';
    process.env.SUPABASE_DB_POOL_MIN = '2';
    process.env.SUPABASE_DB_POOL_MAX = '8';
    process.env.SUPABASE_DB_IDLE_TIMEOUT_MS = '60000';
    process.env.SUPABASE_DB_APPLICATION = 'custom-app';

    const pool = await createDatabasePool();

    expect(mockPoolConfigs).toHaveLength(1);
    expect(mockPoolConfigs[0]).toMatchObject({
      connectionString: process.env.SUPABASE_DB_URL,
      min: 2,
      max: 8,
      idleTimeoutMillis: 60000,
      allowExitOnIdle: true,
      application_name: 'custom-app',
      ssl: { rejectUnauthorized: false },
    });

    const instance = mockPoolInstances[0];
    expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
    await getSharedDatabasePool({ connectionString: process.env.SUPABASE_DB_URL });
    await closeSharedDatabasePool();
    const sharedInstance = mockPoolInstances[mockPoolInstances.length - 1];
    expect(sharedInstance.end).toHaveBeenCalled();
    expect(pool).toBe(instance);
  });
});

describe('withTransaction', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('commits successful handlers', async () => {
    const clientQuery = jest
      .fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // handler query
      .mockResolvedValueOnce({}); // COMMIT

    const client: DatabaseClient = {
      query: clientQuery,
      release: jest.fn(),
    };

    const pool: DatabasePool = {
      query: jest.fn(),
      connect: jest.fn(async () => client),
      end: jest.fn(),
      on: jest.fn(),
    };

    const result = await withTransaction(pool, async (tx: DatabaseClient) => {
      await tx.query('SELECT 1;');
      return 42;
    });

    expect(result).toBe(42);
    expect(clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN;');
    expect(clientQuery).toHaveBeenNthCalledWith(2, 'SELECT 1;');
    expect(clientQuery).toHaveBeenNthCalledWith(3, 'COMMIT;');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back failed handlers and rethrows', async () => {
    const clientQuery = jest
      .fn()
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // handler query
      .mockResolvedValueOnce({}); // ROLLBACK

    const client: DatabaseClient = {
      query: clientQuery,
      release: jest.fn(),
    };

    const pool: DatabasePool = {
      query: jest.fn(),
      connect: jest.fn(async () => client),
      end: jest.fn(),
      on: jest.fn(),
    };

    await expect(
      withTransaction(pool, async (tx: DatabaseClient) => {
        await tx.query('SELECT broken;');
        throw new Error('kaboom');
      }),
    ).rejects.toThrow('kaboom');

    expect(clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN;');
    expect(clientQuery).toHaveBeenNthCalledWith(2, 'SELECT broken;');
    expect(clientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK;');
    expect(client.release).toHaveBeenCalled();
  });
});
