import type {
  TradeCalculation,
  MarketSnapshot,
  TradeExecutionMethod,
  TradeInput,
  TradeOutput,
  TradeSource,
} from '@apex-tradebill/types';
import {
  createTradeCalculation,
  type TradeCalculationRepository,
} from '../trade-calculation/trade-calculation.entity.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface TradeHistoryResult {
  items: TradeCalculation[];
  nextCursor: string | null;
}

export interface TradeHistoryManager {
  list(userId: string, limit?: number, cursor?: string | null): Promise<TradeHistoryResult>;
  readonly isPersistent: boolean;
  setPersistent(next: boolean): void;
}

export interface TradeHistoryManagerDeps {
  tradeCalculations: TradeCalculationRepository;
  now?: () => Date;
  retentionWindowMs?: number;
  isPersistent?: boolean;
}

export const makeTradeHistoryManager = ({
  tradeCalculations,
  now = () => new Date(),
  retentionWindowMs = THIRTY_DAYS_MS,
  isPersistent = true,
}: TradeHistoryManagerDeps): TradeHistoryManager => {
  let persistent = isPersistent;

  const list = async (
    userId: string,
    limit = 20,
    cursor: string | null = null,
  ): Promise<TradeHistoryResult> => {
    const retentionThresholdIso = new Date(now().getTime() - retentionWindowMs).toISOString();
    return tradeCalculations.listRecent(userId, limit, cursor, retentionThresholdIso);
  };

  return {
    list,
    get isPersistent() {
      return persistent;
    },
    setPersistent(next: boolean) {
      persistent = next;
    },
  };
};

export interface TradeHistoryImportEntry {
  id: string;
  input: TradeInput;
  output: TradeOutput;
  marketSnapshot: MarketSnapshot;
  source?: TradeSource;
  createdAt: string;
  executionMethod?: TradeExecutionMethod;
  executedAt?: string;
}

export interface ImportTradeHistoryResult {
  syncedIds: string[];
  failures: Array<{ id: string; error: Error }>;
}

export interface ImportTradeHistoryDeps {
  tradeCalculations: TradeCalculationRepository;
}

export type ImportTradeHistoryUseCase = (
  userId: string,
  entries: TradeHistoryImportEntry[],
) => Promise<ImportTradeHistoryResult>;

export const makeImportTradeHistory = ({
  tradeCalculations,
}: ImportTradeHistoryDeps): ImportTradeHistoryUseCase => {
  return async (userId, entries) => {
    const syncedIds: string[] = [];
    const failures: Array<{ id: string; error: Error }> = [];

    for (const entry of entries) {
      try {
        const calculation = createTradeCalculation({
          userId,
          input: entry.input,
          output: entry.output,
          marketSnapshot: entry.marketSnapshot,
          source: entry.source ?? 'manual',
          createdAt: entry.createdAt,
          executionMethod: entry.executionMethod ?? 'history-import',
          executedAt: entry.executedAt ?? entry.createdAt,
        });
        await tradeCalculations.save(calculation);
        syncedIds.push(entry.id);
      } catch (cause) {
        failures.push({
          id: entry.id,
          error: cause instanceof Error ? cause : new Error('Unknown import error'),
        });
      }
    }

    return {
      syncedIds,
      failures,
    };
  };
};
