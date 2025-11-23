import { createPostgresTradeCalculationRepository } from '../../trade-calculations/tradeCalculationRepository.postgres.js';
import type { SwappableTradeCalculationRepository } from '../../../../domain/trade-calculation/trade-calculation.entity.js';
import {
  getSharedDatabasePool,
  type DatabasePool,
  type DatabasePoolOptions,
} from './pool.js';
import { runMigrations } from './migrations.js';
import { buildDatabasePoolOptions } from '../../../../config/database.js';

export interface DatabaseRecoveryLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface DatabaseRecoveryOptions {
  repository: SwappableTradeCalculationRepository;
  onPersistentResourcesReady: (pool: DatabasePool) => Promise<void> | void;
  logger: DatabaseRecoveryLogger;
  intervalMs?: number;
  registerShutdownHook?: (cleanup: () => void) => void;
  buildPoolOptions?: () => DatabasePoolOptions;
}

const DEFAULT_DB_RECOVERY_INTERVAL_MS = 30_000;

export const scheduleDatabaseRecovery = ({
  repository,
  onPersistentResourcesReady,
  logger,
  intervalMs = DEFAULT_DB_RECOVERY_INTERVAL_MS,
  registerShutdownHook,
  buildPoolOptions: buildOptions = buildDatabasePoolOptions,
}: DatabaseRecoveryOptions): void => {
  let timer: NodeJS.Timeout | null = null;
  let recovered = false;

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const attempt = async () => {
    if (recovered) {
      return;
    }
    try {
      const poolOptions = buildOptions();
      await runMigrations(poolOptions, console);
      const pool = await getSharedDatabasePool(poolOptions);
      repository.swap(createPostgresTradeCalculationRepository(pool));
      await onPersistentResourcesReady(pool);
      recovered = true;
      logger.info('database.recovery_success');
      clearTimer();
    } catch (error) {
      logger.warn('database.recovery_attempt_failed', { err: error });
    }
  };

  timer = setInterval(() => {
    void attempt();
  }, intervalMs);

  registerShutdownHook?.(() => {
    clearTimer();
  });

  void attempt();
};
