import {
  createInMemoryTradeCalculationRepository,
  type TradeCalculationRepository,
} from '../../../domain/trade-calculation/trade-calculation.entity.js';
import { env } from '../../../config/env.js';
import { buildDatabasePoolOptions } from '../../../config/database.js';
import {
  getSharedDatabasePool,
  runPendingMigrations,
  type DatabasePool,
} from '../providers/postgres/pool.js';
import { createPostgresTradeCalculationRepository } from './tradeCalculationRepository.postgres.js';

export interface ResolvedTradeCalculationRepository {
  repository: TradeCalculationRepository;
  pool: DatabasePool | null;
}

export interface ResolveTradeCalculationRepositoryOptions {
  logger: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
  };
}

export const resolveTradeCalculationRepository = async ({
  logger,
}: ResolveTradeCalculationRepositoryOptions): Promise<ResolvedTradeCalculationRepository> => {
  try {
    const pool = await getSharedDatabasePool(buildDatabasePoolOptions());
    await runPendingMigrations(pool);
    logger.info('database.connected');

    return {
      repository: createPostgresTradeCalculationRepository(pool),
      pool,
    };
  } catch (error) {
    logger.warn('database.connection_failed_using_in_memory_repository', { err: error });
    if (!env.database.allowInMemory) {
      throw error;
    }
    return {
      repository: createInMemoryTradeCalculationRepository(),
      pool: null,
    };
  }
};
