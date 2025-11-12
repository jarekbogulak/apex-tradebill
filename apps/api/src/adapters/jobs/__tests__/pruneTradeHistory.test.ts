import { createPruneTradeHistoryJob } from '../pruneTradeHistory.js';
import type { PruneTradeHistoryUseCase } from '../../../domain/trading/pruneTradeHistory.usecase.js';

describe('createPruneTradeHistoryJob', () => {
  const pruneResult = { removed: 5, cutoffIso: '2025-01-01T00:00:00.000Z' };
  let prune: jest.MockedFunction<PruneTradeHistoryUseCase>;

  beforeEach(() => {
    jest.useFakeTimers();
    prune = jest.fn().mockResolvedValue(pruneResult);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs prune use case and logs result', async () => {
    const info = jest.fn();
    const logger = { info, error: jest.fn() };
    const job = createPruneTradeHistoryJob(prune, { logger });

    const result = await job.run();

    expect(result).toEqual(pruneResult);
    expect(prune).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('trade_history.pruned', { result: pruneResult });
  });

  it('schedules recurring runs until cancelled', () => {
    const job = createPruneTradeHistoryJob(prune, { scheduleIntervalMs: 1000 });
    const handle = job.schedule();

    jest.advanceTimersByTime(1000);
    expect(prune).toHaveBeenCalledTimes(1);

    handle.cancel();
    jest.advanceTimersByTime(2000);
    expect(prune).toHaveBeenCalledTimes(1);
  });
});
