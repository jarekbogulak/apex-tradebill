import type { TradeOutput, MarketSnapshot } from '@apex-tradebill/types';
import {
  selectCalculatorInput,
  selectCalculatorOutput,
  selectCalculatorStatus,
  useTradeCalculatorStore,
} from '../tradeCalculatorStore.js';

const buildOutput = (overrides: Partial<TradeOutput> = {}): TradeOutput => ({
  positionSize: '1.23450000',
  positionCost: '123.45000000',
  riskAmount: '2.40000000',
  riskToReward: '2.00',
  suggestedStop: '53000.00000000',
  warningCodes: [],
  atr13: '150.00000000',
  ...overrides,
});

const buildSnapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  symbol: 'BTC-USDT',
  lastPrice: '53123.12000000',
  atr13: '150.00000000',
  atrMultiplier: '1.50',
  bid: '53120.00000000',
  ask: '53126.00000000',
  stale: false,
  source: 'realtime',
  serverTimestamp: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  ...overrides,
});

describe('tradeCalculatorStore selectors and overrides', () => {
  afterEach(() => {
    useTradeCalculatorStore.getState().reset();
  });

  test('selectCalculatorInput reflects merged updates', () => {
    const setInput = useTradeCalculatorStore.getState().setInput;

    setInput({ symbol: 'ETH-USDT', targetPrice: '2500.00' });
    setInput({ riskPercent: '0.01' });

    const selected = selectCalculatorInput(useTradeCalculatorStore.getState());

    expect(selected.symbol).toBe('ETH-USDT');
    expect(selected.targetPrice).toBe('2500.00');
    expect(selected.riskPercent).toBe('0.01');
    expect(selected.entryPrice).toBeNull();
  });

  test('selectCalculatorOutput surfaces last response metadata', () => {
    const timestamp = new Date('2024-01-01T01:00:00.000Z').toISOString();
    const output = buildOutput({ riskToReward: '3.75', warningCodes: ['volatility-stop'] });
    const snapshot = buildSnapshot({ atr13: '175.00000000' });

    useTradeCalculatorStore.getState().setOutput(output, snapshot, output.warningCodes, timestamp);

    const selected = selectCalculatorOutput(useTradeCalculatorStore.getState());

    expect(selected.output).toEqual(output);
    expect(selected.snapshot).toEqual(snapshot);
    expect(selected.warnings).toEqual(['volatility-stop']);
    expect(selected.lastUpdatedAt).toBe(timestamp);
    expect(useTradeCalculatorStore.getState().status).toBe('success');
    expect(useTradeCalculatorStore.getState().error).toBeNull();
  });

  test('status overrides propagate through selector and manual entry flag resets on reset', () => {
    const store = useTradeCalculatorStore.getState();

    store.setStatus('loading');
    expect(selectCalculatorStatus(useTradeCalculatorStore.getState())).toBe('loading');

    store.setStatus('error', 'network');
    expect(selectCalculatorStatus(useTradeCalculatorStore.getState())).toBe('error');
    expect(useTradeCalculatorStore.getState().error).toBe('network');

    store.setHasManualEntry(true);
    expect(useTradeCalculatorStore.getState().hasManualEntry).toBe(true);

    store.reset();
    expect(selectCalculatorStatus(useTradeCalculatorStore.getState())).toBe('idle');
    expect(useTradeCalculatorStore.getState().hasManualEntry).toBe(false);
    expect(useTradeCalculatorStore.getState().error).toBeNull();
  });

  test('setSymbol updates symbol and clears trade-derived state', () => {
    const store = useTradeCalculatorStore.getState();
    store.setInput({
      symbol: 'BTC-USDT',
      entryPrice: '50000.00',
      stopPrice: '49000.00',
      targetPrice: '52000.00',
    });
    store.setHasManualEntry(true);

    const output = buildOutput();
    const snapshot = buildSnapshot();
    store.setOutput(output, snapshot, output.warningCodes, new Date().toISOString());

    store.setSymbol('ETH-USDT');

    const {
      input,
      output: clearedOutput,
      status,
      error,
      hasManualEntry,
    } = useTradeCalculatorStore.getState();

    expect(input.symbol).toBe('ETH-USDT');
    expect(input.entryPrice).toBeNull();
    expect(input.stopPrice).toBeNull();
    expect(input.targetPrice).toBe('0.00');
    expect(hasManualEntry).toBe(false);
    expect(status).toBe('idle');
    expect(error).toBeNull();
    expect(clearedOutput).toBeNull();
  });
});
