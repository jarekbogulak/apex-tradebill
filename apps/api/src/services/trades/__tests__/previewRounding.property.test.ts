import type { MarketDataPort, MarketMetadataPort } from '../../../domain/ports/tradebillPorts.js';
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

describe('Trade preview rounding rules', () => {
  test('rounds position cost to cents while preserving risk budgets', async () => {
    const metadata: MarketMetadataPort = {
      async getMetadata(symbol) {
        if (symbol !== 'BTC-USDT') {
          return null;
        }
        return {
          symbol,
          tickSize: '0.01',
          stepSize: '0.001',
          minNotional: '10.00',
          minQuantity: '0.001',
          status: 'tradable',
          displayName: 'BTC/USDT',
        };
      },
      async listAllowlistedSymbols() {
        return ['BTC-USDT'];
      },
    };

    const marketData: MarketDataPort = {
      async getLatestSnapshot() {
        return defaultSnapshot;
      },
      async getRecentCandles() {
        return candles;
      },
    };

    const repository = createInMemoryTradeCalculationRepository();
    const service = createTradePreviewService({
      marketData,
      metadata,
      tradeCalculations: repository,
    });

    const result = await service.preview('11111111-1111-1111-1111-111111111111', {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '12345.67',
      entryPrice: '110.23',
      stopPrice: '105.11',
      targetPrice: '140.00',
      riskPercent: '0.015',
      atrMultiplier: '1.50',
      useVolatilityStop: false,
      timeframe: '5m',
      accountEquitySource: 'manual',
    });

    expect(result.output.positionCost).toMatch(/^\d+\.\d{2}$/);
    expect(result.output.riskAmount).toMatch(/^\d+\.\d{2}$/);
  });

  test('applies tick size floors to suggested stops', async () => {
    const metadata: MarketMetadataPort = {
      async getMetadata(symbol) {
        if (symbol !== 'BTC-USDT') {
          return null;
        }
        return {
          symbol,
          tickSize: '0.25',
          stepSize: '0.10',
          minNotional: '10.00',
          minQuantity: '0.10',
          status: 'tradable',
          displayName: 'BTC/USDT',
        };
      },
      async listAllowlistedSymbols() {
        return ['BTC-USDT'];
      },
    };

    const marketData: MarketDataPort = {
      async getLatestSnapshot() {
        return defaultSnapshot;
      },
      async getRecentCandles() {
        return candles;
      },
    };

    const repository = createInMemoryTradeCalculationRepository();
    const service = createTradePreviewService({
      marketData,
      metadata,
      tradeCalculations: repository,
    });

    const result = await service.preview('22222222-2222-2222-2222-222222222222', {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '2000.00',
      entryPrice: null,
      stopPrice: '24900.00',
      targetPrice: '25200.00',
      riskPercent: '0.02',
      atrMultiplier: '1.50',
      useVolatilityStop: true,
      timeframe: '1m',
      accountEquitySource: 'connected',
    });

    expect(Number(result.output.suggestedStop) % 0.25).toBe(0);
  });
});
