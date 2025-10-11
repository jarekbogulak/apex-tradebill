import type { MarketCandle } from '../../domain/ports/tradebillPorts.js';

export interface AtrCalculationResult {
  value: number;
  series: number[];
  trueRanges: number[];
}

const sortByTimestampAscending = (candles: MarketCandle[]): MarketCandle[] => {
  return [...candles].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
};

const calculateTrueRange = (current: MarketCandle, previousClose: number | null): number => {
  if (previousClose == null) {
    return current.high - current.low;
  }

  return Math.max(
    current.high - current.low,
    Math.abs(current.high - previousClose),
    Math.abs(current.low - previousClose),
  );
};

export const calculateAtr = (candles: MarketCandle[], period = 13): AtrCalculationResult => {
  if (candles.length < period) {
    throw new Error(`ATR requires at least ${period} candles`);
  }

  const ordered = sortByTimestampAscending(candles);
  const trueRanges: number[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const candle = ordered[index];
    const previousClose = index > 0 ? ordered[index - 1].close : null;
    const range = calculateTrueRange(candle, previousClose);
    trueRanges.push(range);
  }

  const atrSeries: number[] = [];
  let atr = 0;

  const initialWindow = trueRanges.slice(0, period);
  atr = initialWindow.reduce((acc, value) => acc + value, 0) / period;
  atrSeries.push(atr);

  for (let index = period; index < trueRanges.length; index += 1) {
    const range = trueRanges[index];
    atr = (atr * (period - 1) + range) / period;
    atrSeries.push(atr);
  }

  return {
    value: atr,
    series: atrSeries,
    trueRanges,
  };
};
