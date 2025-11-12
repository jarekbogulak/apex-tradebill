import type { MarketSnapshot, Symbol as TradingSymbol, Timeframe } from '@apex-tradebill/types';
import type { MarketCandle, MarketDataPort } from '../../../domain/ports/tradebillPorts.js';
import { DEFAULT_BASE_PRICES } from './defaults.js';

const CANDLE_INTERVAL_MS = 60_000;
const MAX_SERIES_LENGTH = 512;

const TIMEFRAME_MULTIPLIERS: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
};

interface SeriesState {
  candles: MarketCandle[];
  lastTimestampMs: number;
  seed: number;
}

const formatPrice = (value: number, fractionDigits = 2): string => value.toFixed(fractionDigits);

const generateCandleSeries = (symbol: TradingSymbol, count = 256): MarketCandle[] => {
  const base = DEFAULT_BASE_PRICES[symbol] ?? 1_000;
  const now = Date.now();

  return Array.from({ length: count }).map((_, index) => {
    const drift = index * 5;
    const direction = index % 2 === 0 ? 1 : -1;
    const close = base + drift + direction * 3;
    const high = close + 12;
    const low = close - 12;

    return {
      timestamp: new Date(now - (count - index) * 60_000).toISOString(),
      high,
      low,
      close,
    };
  });
};

const aggregateCandles = (series: MarketCandle[], multiplier: number): MarketCandle[] => {
  if (multiplier <= 1) {
    return [...series];
  }

  const aggregated: MarketCandle[] = [];
  let bucketHigh = Number.NEGATIVE_INFINITY;
  let bucketLow = Number.POSITIVE_INFINITY;
  let bucketClose = 0;
  let bucketCount = 0;
  let bucketTimestamp = series[0]?.timestamp ?? new Date().toISOString();

  for (const candle of series) {
    bucketHigh = Math.max(bucketHigh, candle.high);
    bucketLow = Math.min(bucketLow, candle.low);
    bucketClose = candle.close;
    bucketCount += 1;
    bucketTimestamp = candle.timestamp;

    if (bucketCount === multiplier) {
      aggregated.push({
        timestamp: candle.timestamp,
        high: bucketHigh,
        low: bucketLow,
        close: bucketClose,
      });
      bucketHigh = Number.NEGATIVE_INFINITY;
      bucketLow = Number.POSITIVE_INFINITY;
      bucketClose = candle.close;
      bucketCount = 0;
      bucketTimestamp = candle.timestamp;
    }
  }

  if (bucketCount > 0) {
    aggregated.push({
      timestamp: bucketTimestamp,
      high: bucketHigh,
      low: bucketLow,
      close: bucketClose,
    });
  }

  return aggregated;
};

const createSnapshot = (symbol: TradingSymbol, close: number): MarketSnapshot => {
  const bid = close - 2;
  const ask = close + 2;

  return {
    symbol,
    lastPrice: formatPrice(close, 2),
    bid: formatPrice(bid, 2),
    ask: formatPrice(ask, 2),
    atr13: '0.00000000',
    atrMultiplier: '1.50',
    stale: false,
    source: 'stream',
    serverTimestamp: new Date().toISOString(),
  };
};

export const createInMemoryMarketDataProvider = (): MarketDataPort => {
  const seriesBySymbol = new Map<TradingSymbol, SeriesState>();

  const ensureState = (symbol: TradingSymbol): SeriesState => {
    let state = seriesBySymbol.get(symbol);
    if (!state) {
      const candles = generateCandleSeries(symbol);
      const lastTimestamp = candles[candles.length - 1]?.timestamp ?? new Date().toISOString();
      state = {
        candles,
        lastTimestampMs: Date.parse(lastTimestamp),
        seed: Math.random() * 1_000,
      };
      seriesBySymbol.set(symbol, state);
    }
    return state;
  };

  const appendSyntheticCandles = (state: SeriesState): void => {
    const now = Date.now();
    const intervals = Math.max(0, Math.floor((now - state.lastTimestampMs) / CANDLE_INTERVAL_MS));

    if (intervals === 0) {
      return;
    }

    const cappedIntervals = Math.min(intervals, 90);
    const lastClose = state.candles[state.candles.length - 1]?.close ?? 1_000;

    let previousClose = lastClose;
    for (let index = 1; index <= cappedIntervals; index += 1) {
      const timestampMs = state.lastTimestampMs + CANDLE_INTERVAL_MS * index;
      const t = (timestampMs / CANDLE_INTERVAL_MS + state.seed) / 10;
      const drift = Math.sin(t) * 12;
      const volatility = 15 + Math.cos(t / 2) * 5;
      const close = Math.max(1, previousClose + drift);
      const high = close + volatility;
      const low = Math.max(0.1, close - volatility);

      state.candles.push({
        timestamp: new Date(timestampMs).toISOString(),
        high,
        low,
        close,
      });

      previousClose = close;
    }

    state.lastTimestampMs += cappedIntervals * CANDLE_INTERVAL_MS;

    if (state.candles.length > MAX_SERIES_LENGTH) {
      state.candles.splice(0, state.candles.length - MAX_SERIES_LENGTH);
    }
  };

  return {
    async getLatestSnapshot(symbol) {
      const state = ensureState(symbol);
      appendSyntheticCandles(state);

      if (state.candles.length === 0) {
        return null;
      }

      const lastClose =
        state.candles[state.candles.length - 1]?.close ?? DEFAULT_BASE_PRICES[symbol] ?? 1_000;
      const drift = Math.sin(Date.now() / 60_000) * 25;
      return createSnapshot(symbol, lastClose + drift);
    },
    async getRecentCandles(symbol, timeframe, lookback) {
      const state = ensureState(symbol);
      appendSyntheticCandles(state);

      if (state.candles.length === 0) {
        return [];
      }

      const multiplier = TIMEFRAME_MULTIPLIERS[timeframe] ?? 1;
      const aggregated = aggregateCandles(state.candles, multiplier);
      if (aggregated.length === 0) {
        return [];
      }

      const sliceStart = Math.max(aggregated.length - lookback, 0);
      return aggregated.slice(sliceStart);
    },
  };
};
