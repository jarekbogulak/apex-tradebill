import type { DatabasePool } from '../infra/database/pool.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface PruneTradeHistoryJobLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error?(message: string, context?: Record<string, unknown>): void;
}

export interface PruneTradeHistoryJobOptions {
  retentionMs?: number;
  now?: () => Date;
  scheduleIntervalMs?: number;
  logger?: PruneTradeHistoryJobLogger;
}

export interface PruneTradeHistoryResult {
  removed: number;
  cutoffIso: string;
}

export interface ScheduledJobHandle {
  cancel(): void;
}

export interface PruneTradeHistoryJob {
  run(): Promise<PruneTradeHistoryResult>;
  schedule(): ScheduledJobHandle;
}

const defaultLogger: PruneTradeHistoryJobLogger = {
  info(message, context) {
    if (context) {
      console.info(message, context);
    } else {
      console.info(message);
    }
  },
  error(message, context) {
    if (context) {
      console.error(message, context);
    } else {
      console.error(message);
    }
  },
};

export const createPruneTradeHistoryJob = (
  pool: DatabasePool,
  {
    retentionMs = THIRTY_DAYS_MS,
    now = () => new Date(),
    scheduleIntervalMs = ONE_DAY_MS,
    logger = defaultLogger,
  }: PruneTradeHistoryJobOptions = {},
): PruneTradeHistoryJob => {
  const run = async (): Promise<PruneTradeHistoryResult> => {
    const cutoffIso = new Date(now().getTime() - retentionMs).toISOString();
    try {
      const result = await pool.query(
        `DELETE FROM trade_calculations WHERE created_at < $1;`,
        [cutoffIso],
      );

      const removed = result.rowCount ?? 0;
      logger.info('trade_history.pruned', { removed, cutoffIso });
      return { removed, cutoffIso };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error?.('trade_history.prune_failed', { message, cutoffIso });
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

