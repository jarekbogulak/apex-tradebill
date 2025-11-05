import {
  TradeCalculationSchema,
  type MarketSnapshot,
  type TradeCalculation,
  type TradeInput,
  type TradeOutput,
  type TradeExecutionMethod,
  type TradeSource,
} from '@apex-tradebill/types';
import { randomUUID } from 'node:crypto';

const now = () => new Date().toISOString();

export interface NewTradeCalculationInput {
  id?: string;
  userId: string;
  executionMethod: TradeExecutionMethod;
  input: TradeInput;
  output: TradeOutput;
  marketSnapshot: MarketSnapshot;
  source?: TradeSource;
  createdAt?: string;
  executedAt?: string;
}

export const createTradeCalculation = (input: NewTradeCalculationInput): TradeCalculation => {
  const createdAt = input.createdAt ?? now();
  const executedAt = input.executedAt ?? createdAt;
  return TradeCalculationSchema.parse({
    id: input.id ?? randomUUID(),
    userId: input.userId,
    executionMethod: input.executionMethod,
    executedAt,
    input: input.input,
    output: input.output,
    marketSnapshot: input.marketSnapshot,
    source: input.source ?? 'live',
    createdAt,
  });
};

export interface TradeCalculationRepository {
  findById(id: string): Promise<TradeCalculation | null>;
  save(calculation: TradeCalculation): Promise<TradeCalculation>;
  listRecent(
    userId: string,
    limit: number,
    cursor?: string | null,
    since?: string | null,
  ): Promise<{ items: TradeCalculation[]; nextCursor: string | null }>;
}

export const createInMemoryTradeCalculationRepository = (
  seed: TradeCalculation[] = [],
): TradeCalculationRepository => {
  const calculations = new Map<string, TradeCalculation>(seed.map((entry) => [entry.id, entry]));

  const sortedByCreatedAtDesc = (entries: TradeCalculation[]): TradeCalculation[] => {
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };

  return {
    async findById(id) {
      return calculations.get(id) ?? null;
    },
    async save(calculation) {
      const parsed = TradeCalculationSchema.parse(calculation);
      calculations.set(parsed.id, parsed);
      return parsed;
    },
    async listRecent(userId, limit, cursor, since) {
      const entries = Array.from(calculations.values()).filter(
        (entry) =>
          entry.userId === userId &&
          (!cursor || entry.createdAt < cursor) &&
          (!since || entry.createdAt >= since),
      );
      const items = sortedByCreatedAtDesc(entries).slice(0, limit);
      const nextCursor =
        items.length === limit ? (items[items.length - 1]?.createdAt ?? null) : null;
      return { items, nextCursor };
    },
  };
};
