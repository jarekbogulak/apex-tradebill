import { calculateAtr } from '../atrCalculator.js';
import type { MarketCandle } from '../../ports/tradebillPorts.js';

const buildTimestamp = (minutesFromStart: number) => {
  const start = Date.parse('2025-01-01T00:00:00.000Z');
  return new Date(start + minutesFromStart * 60 * 1000).toISOString();
};

const makeCandle = (
  minutesFromStart: number,
  { high, low, close }: { high: number; low: number; close: number },
): MarketCandle => ({
  timestamp: buildTimestamp(minutesFromStart),
  high,
  low,
  close,
});

const createIdenticalCandles = (count: number): MarketCandle[] => {
  return Array.from({ length: count }, (_, index) =>
    makeCandle(index, { high: 110, low: 90, close: 100 }),
  );
};

describe('calculateAtr', () => {
  it('throws when there are fewer candles than the requested period', () => {
    const candles = createIdenticalCandles(12);
    expect(() => calculateAtr(candles)).toThrow('ATR requires at least 13 candles');
  });

  it('sorts candles chronologically and applies Wilder smoothing', () => {
    const unorderedCandles: MarketCandle[] = [
      makeCandle(3, { high: 15, low: 10, close: 12 }),
      makeCandle(0, { high: 10, low: 5, close: 7 }),
      makeCandle(4, { high: 14, low: 9, close: 11 }),
      makeCandle(2, { high: 12, low: 8, close: 9 }),
      makeCandle(1, { high: 11, low: 6, close: 10 }),
    ];

    const result = calculateAtr(unorderedCandles, 3);

    expect(result.trueRanges).toEqual([5, 5, 4, 6, 5]);
    expect(result.series).toHaveLength(3);
    expect(result.series[0]).toBeCloseTo(4.6666666667, 6);
    expect(result.series[1]).toBeCloseTo(5.1111111111, 6);
    expect(result.series[2]).toBeCloseTo(5.0740740741, 6);
    expect(result.value).toBeCloseTo(5.0740740741, 6);
  });

  it('defaults to a 13-period ATR and preserves constant ranges', () => {
    const candles = createIdenticalCandles(13);

    const result = calculateAtr(candles);

    expect(result.series).toEqual([20]);
    expect(result.value).toBe(20);
  });
});
