import { calculateAtr } from '../atrCalculator.js';

const buildCandleSeries = (length: number, basePrice: number, volatility: number) => {
  const candles = [];
  let price = basePrice;

  for (let index = 0; index < length; index += 1) {
    const amplitude = volatility + index * 5;
    const high = price + amplitude;
    const low = price - amplitude;
    const close = price + amplitude / 2;
    candles.push({
      timestamp: new Date(Date.now() + index * 60_000).toISOString(),
      high,
      low,
      close,
    });
    price = close;
  }

  return candles;
};

describe('ATR(13) calculator properties', () => {
  test('monotonic volatility produces non-negative ATR values', () => {
    const candles = buildCandleSeries(20, 50_000, 10);
    const result = calculateAtr(candles, 13);

    expect(result.trueRanges.every((value) => value >= 0)).toBe(true);
    expect(result.series.every((value) => value >= 0)).toBe(true);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  test('rounding floors maintain precision guarantees', () => {
    const flatCandles = Array.from({ length: 13 }, (_, index) => ({
      timestamp: new Date(Date.now() + index * 60_000).toISOString(),
      high: 12_500,
      low: 12_500,
      close: 12_500,
    }));

    const result = calculateAtr(flatCandles, 13);
    expect(result.value).toBe(0);
    expect(result.series).toHaveLength(1);
    expect(result.value.toFixed(8)).toBe('0.00000000');
  });
});
