import {
  createInMemoryTradeCalculationRepository,
  type TradeCalculationRepository,
} from '../../../domain/trade-calculation/trade-calculation.entity.js';
import { env } from '../../../config/env.js';
import { buildDatabasePoolOptions } from '../../../config/database.js';
import {
  getSharedDatabasePool,
  type DatabasePool,
} from '../providers/postgres/pool.js';
import { runMigrations } from '../providers/postgres/migrations.js';
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
  const allowInMemory = env.database.allowInMemory;
  const hasDatabaseUrl = Boolean(env.database.url);
  const forceInMemory = process.env.APEX_FORCE_IN_MEMORY_DB === 'true';

  if ((!hasDatabaseUrl && allowInMemory) || forceInMemory) {
    logger.warn('database.connection_skipped_using_in_memory_repository');
    return {
      repository: createInMemoryTradeCalculationRepository(),
      pool: null,
    };
  }

  try {
    const poolOptions = buildDatabasePoolOptions();
    await runMigrations(poolOptions, console);
    const pool = await getSharedDatabasePool(poolOptions);
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
