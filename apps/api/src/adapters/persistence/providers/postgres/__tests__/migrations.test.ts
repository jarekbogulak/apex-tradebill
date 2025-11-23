import type { RunnerOption } from 'node-pg-migrate';
import type * as migrationsModule from '../migrations.js';

const migrateMock = jest.fn();

const mockModule =
  (jest as unknown as { unstable_mockModule?: typeof jest.mock }).unstable_mockModule ?? jest.mock;

mockModule('node-pg-migrate', () => ({
  __esModule: true,
  default: migrateMock,
  run: migrateMock,
  runner: migrateMock,
}));

const mockPoolInstances: Array<{
  query: jest.Mock;
  connect: jest.Mock;
  end: jest.Mock;
  on: jest.Mock;
}> = [];

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation((_config: unknown) => {
      const clientQuery = jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('to_regclass')) {
          return { rows: [{ exists: 'schema_migrations' }], rowCount: 1 };
        }
        if (sql.includes('SELECT id FROM schema_migrations')) {
          return {
            rows: [{ id: '20240101_init' }, { id: '20240202_features' }],
            rowCount: 2,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      const client = {
        query: clientQuery,
        release: jest.fn(),
      };

      const instance = {
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: jest.fn(async () => client),
        end: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      mockPoolInstances.push(instance);
      return instance;
    }),
  };
});

let runMigrations: typeof migrationsModule.runMigrations;

beforeAll(async () => {
  ({ runMigrations } = await import('../migrations.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPoolInstances.length = 0;
});

describe('runMigrations', () => {
  it('seeds legacy migration rows and runs node-pg-migrate with locking enabled', async () => {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    await runMigrations(
      { connectionString: 'postgres://user:pass@localhost:5432/apex' },
      logger as unknown as Console,
    );

    const instance = mockPoolInstances[0];
    expect(instance.connect).toHaveBeenCalled();

    const client = await instance.connect.mock.results[0].value;
    expect(client.query).toHaveBeenCalledWith('BEGIN;');
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS pgmigrations'),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT to_regclass'),
      ['public.schema_migrations'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id FROM schema_migrations'),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pgmigrations'),
      ['20240101_init'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pgmigrations'),
      ['20240202_features'],
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT;');

    expect(migrateMock).toHaveBeenCalledTimes(1);
    const options = migrateMock.mock.calls[0][0] as RunnerOption;
    expect(options.noLock).toBe(false);
    expect(options.direction).toBe('up');
    expect(options.migrationsTable).toBe('pgmigrations');
    expect(options.dir).toContain('configs/db/migrations');
  });
});
