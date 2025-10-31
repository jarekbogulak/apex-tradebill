import type { DatabaseClient, DatabasePool } from '../../infra/database/pool.js';
import { createPruneTradeHistoryJob } from '../pruneTradeHistory.js';

const createMockPool = (rowCount = 0) => {
  const query: jest.MockedFunction<DatabasePool['query']> = jest
    .fn()
    .mockResolvedValue({
      rows: [],
      rowCount,
    });

  const client: DatabaseClient = {
    query,
    release: jest.fn(),
  };

  const pool: DatabasePool = {
    query,
    connect: jest.fn(async () => client),
    end: jest.fn(async () => undefined),
    on: jest.fn(),
  };

  return { pool, query };
};

describe('createPruneTradeHistoryJob', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('removes rows older than the retention window', async () => {
    const { pool, query } = createMockPool(3);
    const now = () => new Date('2025-02-16T12:00:00.000Z');

    const job = createPruneTradeHistoryJob(pool, {
      retentionMs: 86_400_000, // 1 day
      now,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    });

    const result = await job.run();

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('DELETE FROM trade_calculations');
    expect(params).toEqual(['2025-02-15T12:00:00.000Z']);
    expect(result).toEqual({
      removed: 3,
      cutoffIso: '2025-02-15T12:00:00.000Z',
    });
  });

  it('schedules recurring pruning and supports cancellation', async () => {
    const { pool, query } = createMockPool(0);
    const job = createPruneTradeHistoryJob(pool, {
      retentionMs: 1,
      scheduleIntervalMs: 1_000,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
      },
    });

    const handle = job.schedule();

    jest.advanceTimersByTime(1_000);
    expect(query).toHaveBeenCalledTimes(1);

    handle.cancel();
    jest.advanceTimersByTime(5_000);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
