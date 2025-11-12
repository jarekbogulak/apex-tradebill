import {
  createPruneTradeHistoryJob,
  type PruneTradeHistoryJobLogger,
  type ScheduledJobHandle,
} from './pruneTradeHistory.js';
import type { PruneTradeHistoryUseCase } from '../../domain/trading/pruneTradeHistory.usecase.js';

export interface JobSchedulerLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface CreateJobSchedulerOptions {
  logger: JobSchedulerLogger;
  registerShutdownHook?: (cleanup: () => void) => void;
}

export interface JobScheduler {
  scheduleTradeHistoryPrune(
    pruneUseCase: PruneTradeHistoryUseCase,
    previousHandle?: ScheduledJobHandle | null,
  ): Promise<ScheduledJobHandle>;
}

export type TradeHistoryPruneJobHandle = ScheduledJobHandle;

export const createJobScheduler = ({
  logger,
  registerShutdownHook,
}: CreateJobSchedulerOptions): JobScheduler => {
  const pruneLogger: PruneTradeHistoryJobLogger = {
    info(message, context) {
      logger.info(message, context);
    },
    error(message, context) {
      logger.error(message, context);
    },
  };

  const handles = new Set<ScheduledJobHandle>();

  registerShutdownHook?.(() => {
    for (const handle of handles) {
      handle.cancel();
    }
    handles.clear();
  });

  const scheduleTradeHistoryPrune = async (
    pruneUseCase: PruneTradeHistoryUseCase,
    previousHandle: ScheduledJobHandle | null = null,
  ): Promise<ScheduledJobHandle> => {
    if (previousHandle) {
      previousHandle.cancel();
      handles.delete(previousHandle);
    }

    const pruneJob = createPruneTradeHistoryJob(pruneUseCase, { logger: pruneLogger });

    try {
      const result = await pruneJob.run();
      logger.info('trade_history.prune_startup_run', {
        removed: result.removed,
        cutoffIso: result.cutoffIso,
      });
    } catch (error) {
      logger.error('trade_history.prune_startup_failed', { err: error });
    }

    const handle = pruneJob.schedule();
    handles.add(handle);
    return handle;
  };

  return {
    scheduleTradeHistoryPrune,
  };
};
