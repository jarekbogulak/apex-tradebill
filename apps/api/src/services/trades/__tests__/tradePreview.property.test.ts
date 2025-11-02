import type { MarketDataPort, MarketMetadataPort, SymbolMetadata } from '../../../domain/ports/tradebillPorts.js';
import { createInMemoryTradeCalculationRepository } from '../../../domain/trade-calculation/trade-calculation.entity.js';
import { createTradePreviewService } from '../previewService.js';

const buildCandles = (length: number, center: number, halfRange: number) => {
  return Array.from({ length }, (_, index) => ({
    timestamp: new Date(Date.now() - (length - index) * 60_000).toISOString(),
    high: center + halfRange,
    low: center - halfRange,
    close: center,
  }));
};

const createMetadata = (overrides: Partial<SymbolMetadata> = {}) => {
  const base = {
    symbol: 'BTC-USDT',
    tickSize: '0.01',
    stepSize: '0.000001',
    minNotional: '10.00',
    minQuantity: '0.000100',
    status: 'tradable' as const,
    displayName: 'BTC/USDT',
  };
  return { ...base, ...overrides };
};

describe('Trade preview property suite', () => {
  const PRIMARY_USER_ID = '33333333-3333-3333-3333-333333333333';
  const PRECISION_USER_ID = '44444444-4444-4444-4444-444444444444';

  const defaultSnapshot = {
    symbol: 'BTC-USDT',
    lastPrice: '25000.00',
    bid: null,
    ask: null,
    atr13: '0.00',
    atrMultiplier: '1.00',
    stale: false,
    source: 'stream' as const,
    serverTimestamp: new Date().toISOString(),
  };

  const candles = buildCandles(13, 25000, 50);

  const baseMetadata: MarketMetadataPort = {
    async getMetadata(symbol) {
      if (symbol !== 'BTC-USDT') {
        return null;
      }
      return createMetadata();
    },
    async listAllowlistedSymbols() {
      return ['BTC-USDT'];
    },
  };

  const baseMarketData: MarketDataPort = {
    async getLatestSnapshot() {
      return defaultSnapshot;
    },
    async getRecentCandles() {
      return candles;
    },
  };

  test('position sizing respects account risk caps', async () => {
    const repository = createInMemoryTradeCalculationRepository();
    const service = createTradePreviewService({
      marketData: baseMarketData,
      metadata: baseMetadata,
      tradeCalculations: repository,
    });

    const result = await service.preview(PRIMARY_USER_ID, {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '10000.00',
      entryPrice: '100.00',
      stopPrice: '90.00',
      targetPrice: '130.00',
      riskPercent: '0.02',
      atrMultiplier: '1.50',
      useVolatilityStop: false,
      timeframe: '15m',
      accountEquitySource: 'manual',
    });

    expect(result.output.riskAmount).toBe('200.00');
    expect(Number(result.output.positionSize)).toBeLessThanOrEqual(20);
    expect(result.output.warnings).not.toContain('INSUFFICIENT_EQUITY');
    expect(result.output.atr13).toBe(result.marketSnapshot.atr13);

    const history = await repository.listRecent(PRIMARY_USER_ID, 10);
    expect(history.items).toHaveLength(0);
  });

  test('precision aligns with market tick sizes', async () => {
    const repository = createInMemoryTradeCalculationRepository();
    const metadata: MarketMetadataPort = {
      async getMetadata(symbol) {
        if (symbol !== 'BTC-USDT') {
          return null;
        }
        return createMetadata({
          tickSize: '0.50',
          stepSize: '0.10',
          minNotional: '10000.00',
          minQuantity: '0.10',
        });
      },
      async listAllowlistedSymbols() {
        return ['BTC-USDT'];
      },
    };

    const marketData: MarketDataPort = {
      async getLatestSnapshot() {
        return {
          ...defaultSnapshot,
          lastPrice: '25000.00',
        };
      },
      async getRecentCandles() {
        return candles;
      },
    };

    const service = createTradePreviewService({
      marketData,
      metadata,
      tradeCalculations: repository,
    });

    const result = await service.preview(PRECISION_USER_ID, {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '5000.00',
      entryPrice: null,
      stopPrice: '24900.00',
      targetPrice: '25500.00',
      riskPercent: '0.01',
      atrMultiplier: '1.50',
      useVolatilityStop: true,
      timeframe: '15m',
      accountEquitySource: 'connected',
    });

    expect(result.output.positionSize).toBe('0.30');
    expect(result.output.suggestedStop).toBe('24850.00');
    expect(result.output.positionCost).toBe('7500.00');
    expect(result.output.warnings).toContain('MIN_NOTIONAL');
    expect(result.output.warnings).toContain('VOLATILITY_STOP_GREATER');
  });

  test('supports volatility stop without manual input', async () => {
    const repository = createInMemoryTradeCalculationRepository();
    const service = createTradePreviewService({
      marketData: baseMarketData,
      metadata: baseMetadata,
      tradeCalculations: repository,
    });

    const result = await service.preview(PRIMARY_USER_ID, {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '15000.00',
      entryPrice: null,
      stopPrice: null,
      targetPrice: '26000.00',
      riskPercent: '0.02',
      atrMultiplier: '1.50',
      useVolatilityStop: true,
      timeframe: '15m',
      accountEquitySource: 'connected',
    });

    expect(result.output.suggestedStop).toBeDefined();
    expect(result.output.warnings).not.toContain('VOLATILITY_STOP_GREATER');
    expect(result.output.positionSize).not.toBe('0.0000');
  });

  test('execute persists calculation with execution metadata', async () => {
    const repository = createInMemoryTradeCalculationRepository();
    const service = createTradePreviewService({
      marketData: baseMarketData,
      metadata: baseMetadata,
      tradeCalculations: repository,
    });

    const result = await service.execute(PRIMARY_USER_ID, {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '10000.00',
      entryPrice: '100.00',
      stopPrice: '90.00',
      targetPrice: '130.00',
      riskPercent: '0.02',
      atrMultiplier: '1.50',
      useVolatilityStop: false,
      timeframe: '15m',
      accountEquitySource: 'manual',
    });

    expect(result.calculation.executionMethod).toBe('execute-button');
    expect(result.calculation.executedAt).toBeDefined();
    expect(result.calculation.userId).toBe(PRIMARY_USER_ID);

    const history = await repository.listRecent(PRIMARY_USER_ID, 10);
    expect(history.items).toHaveLength(1);
    expect(history.items[0].executionMethod).toBe('execute-button');
    expect(history.items[0].executedAt).toBe(result.calculation.executedAt);
  });
});
