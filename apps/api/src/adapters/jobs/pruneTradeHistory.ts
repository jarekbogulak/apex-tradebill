import type { PruneTradeHistoryUseCase, PruneTradeHistoryResult } from '../../domain/trading/pruneTradeHistory.usecase.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneTradeHistoryJobLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface PruneTradeHistoryJobOptions {
  scheduleIntervalMs?: number;
  logger?: PruneTradeHistoryJobLogger;
}

export interface ScheduledJobHandle {
  cancel(): void;
}

export interface PruneTradeHistoryJob {
  run(): Promise<PruneTradeHistoryResult>;
  schedule(): ScheduledJobHandle;
}

const defaultLogger: PruneTradeHistoryJobLogger = {
  info() {},
  error() {},
};

export const createPruneTradeHistoryJob = (
  prune: PruneTradeHistoryUseCase,
  { scheduleIntervalMs = ONE_DAY_MS, logger = defaultLogger }: PruneTradeHistoryJobOptions = {},
): PruneTradeHistoryJob => {
  const run = async (): Promise<PruneTradeHistoryResult> => {
    try {
      const result = await prune();
      logger.info('trade_history.pruned', { result });
      return result;
    } catch (error) {
      logger.error?.('trade_history.prune_failed', { err: error });
      throw error;
    }
  };

  const schedule = (): ScheduledJobHandle => {
    const timer = setInterval(() => {
      void run();
    }, scheduleIntervalMs);

    return {
      cancel() {
        clearInterval(timer);
      },
    };
  };

  return {
    run,
    schedule,
  };
};
