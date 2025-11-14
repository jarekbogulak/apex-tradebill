import type {
  ImportTradeHistoryResult,
  ImportTradeHistoryUseCase,
  TradeHistoryImportEntry,
} from '../../domain/trading/tradeHistory.usecases.js';
import {
  createTradeCalculation,
  type TradeCalculationRepository,
} from '../../domain/trade-calculation/trade-calculation.entity.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_CACHE_ENTRY_LIMIT = 20;

const ensureIsoDate = (value: string, label: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} timestamp is invalid`);
  }
  return new Date(timestamp).toISOString();
};

const normalizeEntry = (
  entry: TradeHistoryImportEntry,
  options: { retentionCutoff: number },
): TradeHistoryImportEntry & {
  executedAt: string;
  executionMethod: NonNullable<TradeHistoryImportEntry['executionMethod']>;
} => {
  const createdAtIso = ensureIsoDate(entry.createdAt, 'createdAt');
  const createdAtMs = Date.parse(createdAtIso);
  if (createdAtMs < options.retentionCutoff) {
    throw new Error('Entry createdAt timestamp is outside the retention window');
  }

  const executedAtIso = ensureIsoDate(entry.executedAt ?? createdAtIso, 'executedAt');

  if (entry.marketSnapshot.symbol !== entry.input.symbol) {
    throw new Error('Market snapshot symbol does not match trade input');
  }

  return {
    ...entry,
    createdAt: createdAtIso,
    executedAt: executedAtIso,
    executionMethod: entry.executionMethod ?? 'history-import',
    source: entry.source ?? 'manual',
    input: {
      ...entry.input,
      accountEquitySource: entry.input.accountEquitySource ?? 'connected',
    },
  };
};

export interface HistoryImportServiceDeps {
  tradeCalculations: TradeCalculationRepository;
  now?: () => Date;
  retentionWindowMs?: number;
  maxEntries?: number;
}

export const makeHistoryImportService = ({
  tradeCalculations,
  now = () => new Date(),
  retentionWindowMs = THIRTY_DAYS_MS,
  maxEntries = DEVICE_CACHE_ENTRY_LIMIT,
}: HistoryImportServiceDeps): ImportTradeHistoryUseCase => {
  return async (userId, entries) => {
    if (entries.length > maxEntries) {
      throw new Error(`Import payload exceeds maximum entries (${maxEntries})`);
    }

    const syncedIds: string[] = [];
    const failures: Array<{ id: string; error: Error }> = [];
    const seenIds = new Set<string>();
    const retentionCutoff = now().getTime() - retentionWindowMs;

    for (const entry of entries) {
      if (seenIds.has(entry.id)) {
        failures.push({
          id: entry.id,
          error: new Error('Duplicate entry id in payload'),
        });
        continue;
      }
      seenIds.add(entry.id);

      try {
        const normalized = normalizeEntry(entry, { retentionCutoff });
        const calculation = createTradeCalculation({
          userId,
          executionMethod: normalized.executionMethod,
          input: normalized.input,
          output: normalized.output,
          marketSnapshot: normalized.marketSnapshot,
          source: normalized.source,
          createdAt: normalized.createdAt,
          executedAt: normalized.executedAt,
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
    } satisfies ImportTradeHistoryResult;
  };
};
