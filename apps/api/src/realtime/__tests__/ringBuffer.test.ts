import { createRingBuffer } from '../ringBuffer.js';

jest.mock('../../services/calculations/atrCalculator.js', () => ({
  calculateAtr: jest.fn(() => ({ value: 7.654321 })),
}));

const { calculateAtr: mockCalculateAtr } = jest.requireMock(
  '../../services/calculations/atrCalculator.js',
) as { calculateAtr: jest.Mock };

describe('createRingBuffer', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('ingests ticks and computes ATR once enough candles exist', () => {
    const ringBuffer = createRingBuffer({
      atrPeriod: 2,
      atrTimeframe: '1m',
      aggregateTimeframes: ['1m'],
      staleThresholdMs: 10_000,
    });

    ringBuffer.ingest('BTC-USDT', {
      price: 100,
      bid: 99.5,
      ask: 100.5,
      atrMultiplier: 1.25,
      timestamp: 60_000,
    });

    mockCalculateAtr.mockReturnValueOnce({ value: 7.654321 });

    const snapshot = ringBuffer.ingest('BTC-USDT', {
      price: 110,
      bid: 109,
      ask: 111,
      timestamp: 120_000,
    });

    expect(snapshot).toMatchObject({
      symbol: 'BTC-USDT',
      lastPrice: '110.00000000',
      bid: '109.00000000',
      ask: '111.00000000',
      atrMultiplier: '1.25',
      atr13: '7.65432100',
      stale: false,
    });
    expect(mockCalculateAtr).toHaveBeenCalledTimes(1);
  });

  it('marks snapshots stale when no updates arrive within the threshold', () => {
    const ringBuffer = createRingBuffer({ staleThresholdMs: 2_000 });
    ringBuffer.ingest('ETH-USDT', { price: 200, timestamp: 1_000 });

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_500);
    const fresh = ringBuffer.getSnapshot('ETH-USDT');
    expect(fresh?.stale).toBe(false);

    nowSpy.mockReturnValue(4_000);
    const stale = ringBuffer.getSnapshot('ETH-USDT');
    expect(stale?.stale).toBe(true);
    nowSpy.mockRestore();
  });

  it('samples ticks with carry-forward semantics', () => {
    const ringBuffer = createRingBuffer();

    ringBuffer.ingest('SOL-USDT', { price: 25, timestamp: 1_000 });
    ringBuffer.ingest('SOL-USDT', { price: 27, timestamp: 3_100 });

    const samples = ringBuffer.sampleTicks('SOL-USDT', 1_000);

    expect(samples).toHaveLength(3);
    expect(samples[0].tick.price).toBe(25);
    expect(samples[1].carried).toBe(true);
    expect(samples[2].tick.price).toBe(27);
  });

  it('tracks symbols and allows manual stale marking', () => {
    const ringBuffer = createRingBuffer({ staleThresholdMs: 1_000 });
    ringBuffer.ingest('ARB-USDT', { price: 1.5, timestamp: 1_000 });

    expect(ringBuffer.getTrackedSymbols()).toEqual(['ARB-USDT']);

    ringBuffer.markStale('ARB-USDT');
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(3_500);
    const snapshot = ringBuffer.getSnapshot('ARB-USDT');

    expect(snapshot?.stale).toBe(true);
    nowSpy.mockRestore();
  });
});
