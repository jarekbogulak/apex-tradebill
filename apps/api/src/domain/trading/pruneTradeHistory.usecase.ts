import type { TradeCalculationRepository } from '../trade-calculation/trade-calculation.entity.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface PruneTradeHistoryDeps {
  repository: TradeCalculationRepository;
  now?: () => Date;
  retentionWindowMs?: number;
}

export interface PruneTradeHistoryResult {
  removed: number;
  cutoffIso: string;
}

export type PruneTradeHistoryUseCase = () => Promise<PruneTradeHistoryResult>;

export const makePruneTradeHistory = ({
  repository,
  now = () => new Date(),
  retentionWindowMs = THIRTY_DAYS_MS,
}: PruneTradeHistoryDeps): PruneTradeHistoryUseCase => {
  return async () => {
    const cutoffIso = new Date(now().getTime() - retentionWindowMs).toISOString();
    const removed = await repository.deleteOlderThan(cutoffIso);
    return { removed, cutoffIso };
  };
};
