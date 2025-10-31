import { calculateAtr } from '../atrCalculator.js';
import type { MarketCandle } from '../../../domain/ports/tradebillPorts.js';

const buildCandle = (timestamp: string, high: number, low: number, close: number): MarketCandle => ({
  timestamp,
  high,
  low,
  close,
});

describe('calculateAtr', () => {
  test('throws when the available candles are below the requested period', () => {
    const candles: MarketCandle[] = Array.from({ length: 12 }, (_, index) =>
      buildCandle(`2024-01-01T00:${String(index).padStart(2, '0')}:00.000Z`, 100 + index, 90 + index, 95 + index),
    );

    expect(() => calculateAtr(candles, 13)).toThrow('ATR requires at least 13 candles');
  });

  test('sorts incoming candles before performing the calculation', () => {
    const ordered: MarketCandle[] = [
      buildCandle('2024-01-01T00:00:00.000Z', 50, 45, 47),
      buildCandle('2024-01-01T00:01:00.000Z', 55, 48, 50),
      buildCandle('2024-01-01T00:02:00.000Z', 54, 49, 51),
      buildCandle('2024-01-01T00:03:00.000Z', 60, 52, 55),
      buildCandle('2024-01-01T00:04:00.000Z', 58, 53, 54),
    ];

    const shuffled = [...ordered.slice(2), ...ordered.slice(0, 2)];

    const reference = calculateAtr(ordered, 3);
    const result = calculateAtr(shuffled, 3);

    expect(result.trueRanges).toEqual(reference.trueRanges);
    expect(result.series).toEqual(reference.series);
    expect(result.value).toBeCloseTo(reference.value, 10);
  });

  test('uses Wilder smoothing and previous close differences for true range gaps', () => {
    const candles: MarketCandle[] = [
      buildCandle('2024-01-01T00:00:00.000Z', 50, 45, 47), // tr = 5
      buildCandle('2024-01-01T00:01:00.000Z', 55, 48, 50), // tr = max(7, 8, 1) = 8
      buildCandle('2024-01-01T00:02:00.000Z', 54, 49, 51), // tr = max(5, 4, 1) = 5
      buildCandle('2024-01-01T00:03:00.000Z', 60, 52, 55), // tr = max(8, 9, 3) = 9
      buildCandle('2024-01-01T00:04:00.000Z', 58, 53, 54), // tr = max(5, 3, 2) = 5
    ];

    const { trueRanges, series, value } = calculateAtr(candles, 3);

    expect(trueRanges).toEqual([5, 8, 5, 9, 5]);
    expect(series).toHaveLength(3);
    expect(series[0]).toBeCloseTo(6, 10);
    expect(series[1]).toBeCloseTo(7, 10);
    expect(series[2]).toBeCloseTo(6.3333333333, 10);
    expect(value).toBe(series[series.length - 1]);
  });
});
