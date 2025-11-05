import type { TradeCalculation } from '@apex-tradebill/types';
import type { TradeCalculationRepository } from '../../domain/trade-calculation/trade-calculation.entity.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface TradeHistoryServiceDeps {
  tradeCalculations: TradeCalculationRepository;
  now?: () => Date;
}

export interface TradeHistoryResult {
  items: TradeCalculation[];
  nextCursor: string | null;
}

export const createTradeHistoryService = ({
  tradeCalculations,
  now = () => new Date(),
}: TradeHistoryServiceDeps) => {
  const list = async (
    userId: string,
    limit = 20,
    cursor: string | null = null,
  ): Promise<TradeHistoryResult> => {
    const retentionThresholdIso = new Date(now().getTime() - THIRTY_DAYS_MS).toISOString();

    return tradeCalculations.listRecent(userId, limit, cursor, retentionThresholdIso);
  };

  return {
    list,
  };
};

export type TradeHistoryService = ReturnType<typeof createTradeHistoryService>;
