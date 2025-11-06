import type { TradeInput } from '@apex-tradebill/types';

import type { TradeCalculatorInputState } from '@/src/state/tradeCalculatorStore';

import { prepareTradePayload } from '../useTradeCalculatorOperations.js';

const baseInput: TradeCalculatorInputState = {
  symbol: 'BTC-USDT',
  direction: 'long',
  accountSize: '1000.00',
  entryPrice: '43000.00',
  stopPrice: null,
  targetPrice: '45000.00',
  riskPercent: '0.02',
  atrMultiplier: '1.50',
  useVolatilityStop: true,
  timeframe: '15m',
  accountEquitySource: 'connected',
};

const buildPayload = (overrides: Partial<TradeCalculatorInputState> = {}) => {
  return prepareTradePayload({
    input: { ...baseInput, ...overrides },
    settingsRiskPercent: '0.02',
    settingsAtrMultiplier: '1.50',
  });
};

describe('prepareTradePayload', () => {
  test('returns error when account size is zero', () => {
    const result = buildPayload({ accountSize: '0.00' });

    expect(result.payload).toBeNull();
    expect(result.error).toBe('Account size must be greater than zero');
  });

  test('returns payload when account size is valid', () => {
    const result = buildPayload();

    expect(result.error).toBeNull();
    expect(result.payload).not.toBeNull();
    expect((result.payload as TradeInput).accountSize).toBe('1000.00');
  });

  test('returns stop required error when manual stop missing', () => {
    const result = buildPayload({
      useVolatilityStop: false,
      stopPrice: null,
    });

    expect(result.payload).toBeNull();
    expect(result.error).toBe('Stop price is required when volatility stop is disabled');
  });
});
