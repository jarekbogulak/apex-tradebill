import type { TradeInput, MarketSnapshot } from '@apex-tradebill/types';
import type {
  MarketCandle,
  MarketDataPort,
  MarketMetadataPort,
  SymbolMetadata,
} from '../../ports/tradebillPorts.js';
import {
  makeExecuteTrade,
  makePreviewTrade,
} from '../tradePreview.usecases.js';
import type { TradeCalculationRepository } from '../../trade-calculation/trade-calculation.entity.js';

const USER_ID = '11111111-2222-3333-4444-555555555555';

const buildTimestamp = (minutesFromStart: number) => {
  const start = Date.parse('2025-01-01T00:00:00.000Z');
  return new Date(start + minutesFromStart * 60 * 1000).toISOString();
};

const createAtrCandles = (overrides: Partial<MarketCandle> = {}): MarketCandle[] => {
  return Array.from({ length: 13 }, (_, index) => ({
    timestamp: buildTimestamp(index),
    high: 110,
    low: 90,
    close: 100,
    ...overrides,
  }));
};

const buildSnapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  symbol: 'BTC-USDT',
  lastPrice: '100.00',
  bid: '99.95',
  ask: '100.05',
  atr13: '15.00000000',
  atrMultiplier: '1.50',
  stale: false,
  source: 'stream',
  serverTimestamp: buildTimestamp(0),
  ...overrides,
});

const buildMetadata = (overrides: Partial<SymbolMetadata> = {}): SymbolMetadata => ({
  symbol: 'BTC-USDT',
  tickSize: '0.01',
  stepSize: '0.001',
  minNotional: '10.00',
  minQuantity: '0.001',
  status: 'tradable',
  ...overrides,
});

const createDeps = ({
  snapshot: snapshotOverrides,
  metadata: metadataOverrides,
  candles,
}: {
  snapshot?: Partial<MarketSnapshot>;
  metadata?: Partial<SymbolMetadata>;
  candles?: MarketCandle[];
} = {}) => {
  const snapshot = buildSnapshot(snapshotOverrides);
  const metadataValue = buildMetadata(metadataOverrides);
  const marketData: jest.Mocked<MarketDataPort> = {
    getLatestSnapshot: jest.fn().mockResolvedValue(snapshot),
    getRecentCandles: jest.fn().mockResolvedValue(candles ?? createAtrCandles()),
  };
  const metadata: jest.Mocked<MarketMetadataPort> = {
    getMetadata: jest.fn().mockResolvedValue(metadataValue),
    listAllowlistedSymbols: jest.fn(),
  };
  return { marketData, metadata, snapshot, metadataValue };
};

const buildInput = (overrides: Partial<TradeInput> = {}): TradeInput => ({
  symbol: 'BTC-USDT',
  direction: 'long',
  accountSize: '10000.00',
  entryPrice: '100.00',
  stopPrice: '95.00',
  targetPrice: '160.00',
  riskPercent: '0.02',
  atrMultiplier: '1.50',
  useVolatilityStop: false,
  timeframe: '15m',
  accountEquitySource: 'connected',
  ...overrides,
});

const createTradeCalculations = (): jest.Mocked<TradeCalculationRepository> => ({
  findById: jest.fn(),
  save: jest.fn(async (calculation) => calculation),
  listRecent: jest.fn(),
  deleteOlderThan: jest.fn(),
});

describe('trade preview use cases', () => {
  it('computes sizing from live snapshots when entry price is not provided', async () => {
    const { marketData, metadata } = createDeps();
    const previewTrade = makePreviewTrade({ marketData, metadata });

    const input = buildInput({
      entryPrice: null,
      stopPrice: null,
      useVolatilityStop: true,
    });

    const result = await previewTrade(USER_ID, input);

    expect(result.output).toMatchObject({
      positionSize: '6.666',
      positionCost: '666.60',
      riskAmount: '199.98',
      riskToReward: 2,
      suggestedStop: '70.00',
      atr13: '20.00000000',
      warnings: [],
    });
    expect(result.marketSnapshot.atr13).toBe('20.00000000');
    expect(result.marketSnapshot.atrMultiplier).toBe(input.atrMultiplier);
    expect(marketData.getLatestSnapshot).toHaveBeenCalledWith('BTC-USDT');
  });

  it('surfaces warnings for stale prices and minimum order constraints', async () => {
    const { marketData, metadata } = createDeps({
      snapshot: { stale: true },
      metadata: {
        stepSize: '1',
        minQuantity: '5',
        minNotional: '50.00',
      },
    });

    const previewTrade = makePreviewTrade({ marketData, metadata });

    const input = buildInput({
      accountSize: '50.00',
      riskPercent: '0.01',
      entryPrice: '50.00',
      stopPrice: '49.00',
      targetPrice: '120.00',
      atrMultiplier: '2.00',
      useVolatilityStop: false,
    });

    const result = await previewTrade(USER_ID, input);

    expect(result.output.positionSize).toBe('0');
    expect(result.output.riskAmount).toBe('0.00');
    expect(result.warnings).toEqual([
      'ATR_STALE',
      'INSUFFICIENT_EQUITY',
      'MIN_LOT_SIZE',
      'MIN_NOTIONAL',
    ]);
    expect(result.output.warnings).toEqual(result.warnings);
  });
});

describe('trade execution use case', () => {
  it('persists calculations and returns the saved entity', async () => {
    const { marketData, metadata } = createDeps();
    const tradeCalculations = createTradeCalculations();
    const executeTrade = makeExecuteTrade({ marketData, metadata, tradeCalculations });

    const input = buildInput({
      accountEquitySource: 'manual',
      useVolatilityStop: false,
      entryPrice: '105.00',
      stopPrice: '100.00',
      targetPrice: '140.00',
    });

    const result = await executeTrade(USER_ID, input);

    expect(tradeCalculations.save).toHaveBeenCalledTimes(1);
    const savedCalculation = tradeCalculations.save.mock.calls[0][0];
    expect(savedCalculation.userId).toBe(USER_ID);
    expect(savedCalculation.executionMethod).toBe('execute-button');
    expect(savedCalculation.source).toBe('manual');
    expect(result.calculation).toEqual(savedCalculation);
    expect(result.output).toEqual(savedCalculation.output);
    expect(result.marketSnapshot.symbol).toBe('BTC-USDT');
  });
});
