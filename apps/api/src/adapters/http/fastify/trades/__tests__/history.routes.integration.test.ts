import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import postHistoryImportRoute from '../postHistoryImport.js';
import getHistoryRoute from '../getHistory.js';
import { createInMemoryTradeCalculationRepository } from '@api/domain/trade-calculation/trade-calculation.entity.js';
import {
  makeTradeHistoryManager,
  type TradeHistoryImportEntry,
} from '@api/domain/trading/tradeHistory.usecases.js';
import { makeHistoryImportService } from '@api/services/trades/historyImportService.js';
import type { MarketSnapshot, TradeInput, TradeOutput } from '@apex-tradebill/types';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const DEFAULT_NOW = new Date('2025-02-01T00:00:00.000Z');

const baseInput: TradeInput = {
  symbol: 'BTC-USDT',
  direction: 'long',
  accountSize: '1000.00',
  entryPrice: '100.00',
  stopPrice: '95.00',
  targetPrice: '130.00',
  riskPercent: '0.02',
  atrMultiplier: '1.50',
  useVolatilityStop: false,
  timeframe: '15m',
  accountEquitySource: 'connected',
};

const baseOutput: TradeOutput = {
  positionSize: '2.000000',
  positionCost: '200.00',
  riskAmount: '100.00',
  riskToReward: 2,
  suggestedStop: '95.00',
  atr13: '15.00000000',
  warnings: [],
};

const baseSnapshot: MarketSnapshot = {
  symbol: 'BTC-USDT',
  lastPrice: '100.00',
  bid: '99.95',
  ask: '100.05',
  atr13: '15.00000000',
  atrMultiplier: '1.50',
  stale: false,
  source: 'stream',
  serverTimestamp: DEFAULT_NOW.toISOString(),
};

interface ImportEntryOverrides {
  id?: string;
  createdAt?: string;
  executedAt?: string;
  input?: Partial<TradeInput>;
  output?: Partial<TradeOutput>;
  marketSnapshot?: Partial<MarketSnapshot>;
}

const buildImportEntry = (overrides: ImportEntryOverrides = {}): TradeHistoryImportEntry => {
  const createdAt = overrides.createdAt ?? DEFAULT_NOW.toISOString();
  return {
    id: overrides.id ?? randomUUID(),
    input: { ...baseInput, ...overrides.input },
    output: { ...baseOutput, ...overrides.output },
    marketSnapshot: { ...baseSnapshot, ...overrides.marketSnapshot },
    source: 'live',
    createdAt,
    executedAt: overrides.executedAt ?? createdAt,
    executionMethod: 'history-import',
  };
};

const buildTestServer = async (now: Date = DEFAULT_NOW): Promise<FastifyInstance> => {
  const tradeCalculations = createInMemoryTradeCalculationRepository();
  const nowProvider = () => new Date(now.getTime());
  const tradeHistory = makeTradeHistoryManager({
    tradeCalculations,
    now: nowProvider,
    isPersistent: true,
  });
  const importTradeHistory = makeHistoryImportService({ tradeCalculations, now: nowProvider });

  const app = Fastify();
  await app.register(postHistoryImportRoute, { importTradeHistory });
  await app.register(getHistoryRoute, { tradeHistory });
  await app.ready();
  return app;
};

describe('history routes integration', () => {
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.length = 0;
  });

  test('imports cached calculations and exposes them via GET /v1/trades/history', async () => {
    const app = await buildTestServer();
    servers.push(app);

    const entries = [
      buildImportEntry({ id: 'device-entry-1', createdAt: '2025-02-01T00:00:00.000Z' }),
      buildImportEntry({
        id: 'device-entry-2',
        createdAt: '2025-02-01T00:05:00.000Z',
        input: { targetPrice: '140.00' },
      }),
    ];

    const importResponse = await app.inject({
      method: 'POST',
      url: '/v1/trades/history/import',
      payload: { entries },
      headers: { 'x-user-id': USER_ID },
    });

    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.json()).toEqual({ syncedIds: ['device-entry-1', 'device-entry-2'] });

    const historyResponse = await app.inject({
      method: 'GET',
      url: '/v1/trades/history',
      headers: { 'x-user-id': USER_ID },
    });

    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json() as {
      items: Array<{ input: TradeInput; createdAt: string }>;
      nextCursor: string | null;
    };

    expect(history.items).toHaveLength(2);
    expect(history.items[0].input.targetPrice).toBe('140.00');
    expect(history.items[1].input.targetPrice).toBe('130.00');
    expect(history.nextCursor).toBeNull();
  });

  test('filters out calculations older than the 30-day retention window', async () => {
    const fixedNow = new Date('2025-03-01T00:00:00.000Z');
    const app = await buildTestServer(fixedNow);
    servers.push(app);

    const staleCreatedAt = new Date(fixedNow.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const freshCreatedAt = new Date(fixedNow.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const entries = [
      buildImportEntry({ id: 'stale-entry', createdAt: staleCreatedAt }),
      buildImportEntry({ id: 'fresh-entry', createdAt: freshCreatedAt }),
    ];

    const importResponse = await app.inject({
      method: 'POST',
      url: '/v1/trades/history/import',
      payload: { entries },
      headers: { 'x-user-id': USER_ID },
    });

    expect(importResponse.statusCode).toBe(200);

    const historyResponse = await app.inject({
      method: 'GET',
      url: '/v1/trades/history',
      headers: { 'x-user-id': USER_ID },
    });

    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json() as { items: Array<{ id: string; createdAt: string }> };

    expect(history.items).toHaveLength(1);
    expect(history.items[0].createdAt).toBe(freshCreatedAt);
    expect(history.items[0].id).toBeDefined();
  });

  test('deduplicates duplicate entry ids and rejects stale records', async () => {
    const app = await buildTestServer();
    servers.push(app);

    const duplicateId = 'duplicate-entry';
    const staleCreatedAt = new Date(DEFAULT_NOW.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString();

    const entries = [
      buildImportEntry({ id: duplicateId, createdAt: '2025-02-01T00:10:00.000Z' }),
      buildImportEntry({
        id: duplicateId,
        createdAt: '2025-02-01T00:15:00.000Z',
        input: { targetPrice: '150.00' },
      }),
      buildImportEntry({ id: 'stale-entry', createdAt: staleCreatedAt }),
    ];

    const importResponse = await app.inject({
      method: 'POST',
      url: '/v1/trades/history/import',
      payload: { entries },
      headers: { 'x-user-id': USER_ID },
    });

    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.json()).toEqual({ syncedIds: [duplicateId] });

    const historyResponse = await app.inject({
      method: 'GET',
      url: '/v1/trades/history',
      headers: { 'x-user-id': USER_ID },
    });

    const history = historyResponse.json() as {
      items: Array<{ id: string; input: TradeInput }>;
      nextCursor: null;
    };
    expect(history.items).toHaveLength(1);
    expect(history.items[0].input.targetPrice).toBe('130.00');
  });
});
