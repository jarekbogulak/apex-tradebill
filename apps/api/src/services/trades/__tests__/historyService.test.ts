import { createTradeHistoryService } from '../historyService.js';
import { createTradeCalculation } from '../../../domain/trade-calculation/trade-calculation.entity.js';
import { createInMemoryTradeCalculationRepository } from '../../../domain/trade-calculation/trade-calculation.entity.js';

const USER_ID = '55555555-5555-5555-5555-555555555555';

const buildCalculation = (overrides: Partial<Parameters<typeof createTradeCalculation>[0]> = {}) => {
  return createTradeCalculation({
    userId: USER_ID,
    input: {
      symbol: 'BTC-USDT',
      direction: 'long',
      accountSize: '1000.00',
      entryPrice: '100.00',
      stopPrice: '95.00',
      targetPrice: '120.00',
      riskPercent: '0.02',
      atrMultiplier: '1.50',
      useVolatilityStop: false,
      timeframe: '15m',
      accountEquitySource: 'connected',
    },
    output: {
      positionSize: '2.000000',
      positionCost: '200.00',
      riskAmount: '100.00',
      riskToReward: 4,
      suggestedStop: '95.00',
      atr13: '10.00000000',
      warnings: [],
    },
    marketSnapshot: {
      symbol: 'BTC-USDT',
      lastPrice: '100.00',
      bid: null,
      ask: null,
      atr13: '5.00000000',
      atrMultiplier: '1.50',
      stale: false,
      source: 'stream',
      serverTimestamp: new Date().toISOString(),
    },
    source: 'live',
    ...overrides,
  });
};

describe('Trade history service', () => {
  test('filters out calculations beyond the retention window', async () => {
    const recent = buildCalculation({ createdAt: new Date().toISOString() });
    const old = buildCalculation({
      id: '99999999-9999-9999-9999-999999999999',
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const repository = createInMemoryTradeCalculationRepository([recent, old]);
    const service = createTradeHistoryService({
      tradeCalculations: repository,
      now: () => new Date(),
    });

    const history = await service.list(USER_ID, 10);
    expect(history.items).toHaveLength(1);
    expect(history.items[0].id).toBe(recent.id);
  });
});
