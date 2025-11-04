import type { MarketSnapshot, Symbol, Timeframe } from '@apex-tradebill/types';
import type { MarketCandle } from '../domain/ports/tradebillPorts.js';
import { calculateAtr } from '../services/calculations/atrCalculator.js';
import { sampleLatestPerWindow, type PriceTick, type SampledTick } from './windowSampler.js';

export interface MarketTickInput {
  price: number | string;
  bid?: number | string | null;
  ask?: number | string | null;
  atrMultiplier?: number | string | null;
  timestamp?: number;
}

export interface RingBufferOptions {
  maxTicks?: number;
  maxCandles?: number;
  staleThresholdMs?: number;
  atrPeriod?: number;
  atrTimeframe?: Timeframe;
  aggregateTimeframes?: Timeframe[];
  defaultAtrMultiplier?: string;
}

interface SymbolState {
  ticks: PriceTick[];
  candlesByTimeframe: Partial<Record<Timeframe, MarketCandle[]>>;
  snapshot: MarketSnapshot | null;
  atrMultiplier: string;
  lastUpdatedAt: number;
}

const DEFAULT_MAX_TICKS = 2048;
const DEFAULT_MAX_CANDLES = 1024;
const DEFAULT_STALE_THRESHOLD_MS = 2000;
const DEFAULT_ATR_PERIOD = 13;
const DEFAULT_ATR_MULTIPLIER = '1.50';
const DEFAULT_ATR_TIMEFRAME: Timeframe = '15m';
const DEFAULT_AGGREGATE_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m'];

const TIMEFRAME_WINDOW_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
};

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPriceString = (value: number | string): string => {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  return numeric.toFixed(8);
};

const clampArray = <T>(items: T[], max: number): void => {
  if (items.length <= max) {
    return;
  }
  items.splice(0, items.length - max);
};

const resolveAggregateTimeframes = (options: RingBufferOptions): Timeframe[] => {
  const requested = options.aggregateTimeframes ?? DEFAULT_AGGREGATE_TIMEFRAMES;
  return requested.filter((timeframe) => timeframe in TIMEFRAME_WINDOW_MS);
};

const ensureState = (
  symbol: Symbol,
  store: Map<Symbol, SymbolState>,
  options: RingBufferOptions,
): SymbolState => {
  let state = store.get(symbol);
  if (state) {
    return state;
  }

  state = {
    ticks: [],
    candlesByTimeframe: {},
    snapshot: null,
    atrMultiplier: options.defaultAtrMultiplier ?? DEFAULT_ATR_MULTIPLIER,
    lastUpdatedAt: 0,
  };

  for (const timeframe of resolveAggregateTimeframes(options)) {
    state.candlesByTimeframe[timeframe] = [];
  }

  store.set(symbol, state);
  return state;
};

const updateCandles = (
  aggregateTimeframes: Timeframe[],
  state: SymbolState,
  timestampMs: number,
  price: number,
  maxCandles: number,
): void => {
  for (const timeframe of aggregateTimeframes) {
    const windowMs = TIMEFRAME_WINDOW_MS[timeframe];
    if (!windowMs) {
      continue;
    }

    const windowStart = Math.floor(timestampMs / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;
    const timestampIso = new Date(windowEnd).toISOString();

    let candles = state.candlesByTimeframe[timeframe];
    if (!candles) {
      candles = [];
      state.candlesByTimeframe[timeframe] = candles;
    }

    const last = candles[candles.length - 1];
    if (!last || new Date(last.timestamp).getTime() !== windowEnd) {
      candles.push({
        timestamp: timestampIso,
        high: price,
        low: price,
        close: price,
      });
    } else {
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.close = price;
    }

    clampArray(candles, maxCandles);
  }
};

const computeAtr = (candles: MarketCandle[] | undefined, period: number): number | null => {
  if (!candles || candles.length < period) {
    return null;
  }

  const subset = candles.slice(-(period + 1));
  try {
    const result = calculateAtr(subset, period);
    return result.value;
  } catch {
    return null;
  }
};

export interface RingBuffer {
  ingest(symbol: Symbol, tick: MarketTickInput): MarketSnapshot;
  getSnapshot(symbol: Symbol): MarketSnapshot | null;
  getRecentCandles(symbol: Symbol, timeframe: Timeframe, lookback: number): MarketCandle[];
  getTicks(symbol: Symbol): PriceTick[];
  sampleTicks(symbol: Symbol, windowMs: number): SampledTick[];
  markStale(symbol: Symbol): void;
  getTrackedSymbols(): Symbol[];
}

export const createRingBuffer = (options: RingBufferOptions = {}): RingBuffer => {
  const store = new Map<Symbol, SymbolState>();
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;
  const maxCandles = options.maxCandles ?? DEFAULT_MAX_CANDLES;
  const staleThresholdMs = options.staleThresholdMs ?? DEFAULT_STALE_THRESHOLD_MS;
  const atrPeriod = options.atrPeriod ?? DEFAULT_ATR_PERIOD;
  const atrTimeframe = options.atrTimeframe ?? DEFAULT_ATR_TIMEFRAME;
  const aggregateTimeframes = resolveAggregateTimeframes(options);

  const ingest = (symbol: Symbol, tick: MarketTickInput): MarketSnapshot => {
    const state = ensureState(symbol, store, options);
    const timestampMs = tick.timestamp ?? Date.now();
    const price = toNumber(tick.price) ?? 0;
    state.lastUpdatedAt = timestampMs;

    state.ticks.push({ timestamp: timestampMs, price });
    clampArray(state.ticks, maxTicks);

    updateCandles(aggregateTimeframes, state, timestampMs, price, maxCandles);

    const atrCandles = state.candlesByTimeframe[atrTimeframe];
    const atr = computeAtr(atrCandles, atrPeriod);
    const bid = toNumber(tick.bid);
    const ask = toNumber(tick.ask);
    if (tick.atrMultiplier != null) {
      state.atrMultiplier = String(tick.atrMultiplier);
    }

    const snapshot: MarketSnapshot = {
      symbol,
      lastPrice: toPriceString(price),
      bid: bid != null ? toPriceString(bid) : (state.snapshot?.bid ?? null),
      ask: ask != null ? toPriceString(ask) : (state.snapshot?.ask ?? null),
      atr13: atr != null ? toPriceString(atr) : (state.snapshot?.atr13 ?? '0.00000000'),
      atrMultiplier: state.atrMultiplier,
      stale: false,
      source: 'stream',
      serverTimestamp: new Date(timestampMs).toISOString(),
    };

    state.snapshot = snapshot;
    return snapshot;
  };

  const getSnapshot = (symbol: Symbol): MarketSnapshot | null => {
    const state = store.get(symbol);
    if (!state?.snapshot) {
      return null;
    }

    const stale = Date.now() - state.lastUpdatedAt > staleThresholdMs;
    return {
      ...state.snapshot,
      stale,
    };
  };

  const getRecentCandles = (
    symbol: Symbol,
    timeframe: Timeframe,
    lookback: number,
  ): MarketCandle[] => {
    const state = store.get(symbol);
    if (!state) {
      return [];
    }
    const series = state.candlesByTimeframe[timeframe];
    if (!series?.length) {
      return [];
    }
    return series.slice(-lookback);
  };

  const getTicks = (symbol: Symbol): PriceTick[] => {
    const state = store.get(symbol);
    if (!state) {
      return [];
    }
    return [...state.ticks];
  };

  const sampleTicks = (symbol: Symbol, windowMs: number): SampledTick[] => {
    return sampleLatestPerWindow(getTicks(symbol), windowMs, { carryForward: true });
  };

  const markStale = (symbol: Symbol): void => {
    const state = store.get(symbol);
    if (!state?.snapshot) {
      return;
    }
    state.snapshot = {
      ...state.snapshot,
      stale: true,
    };
  };

  const getTrackedSymbols = (): Symbol[] => {
    return Array.from(store.keys());
  };

  return {
    ingest,
    getSnapshot,
    getRecentCandles,
    getTicks,
    sampleTicks,
    markStale,
    getTrackedSymbols,
  };
};
