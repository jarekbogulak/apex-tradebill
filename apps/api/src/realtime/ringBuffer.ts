import type { MarketSnapshot, Symbol } from '@apex-tradebill/types';
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
  candleWindowMs?: number;
  atrPeriod?: number;
  defaultAtrMultiplier?: string;
}

interface SymbolState {
  ticks: PriceTick[];
  candles: MarketCandle[];
  snapshot: MarketSnapshot | null;
  atrMultiplier: string;
  lastUpdatedAt: number;
}

const DEFAULT_MAX_TICKS = 2048;
const DEFAULT_MAX_CANDLES = 1024;
const DEFAULT_STALE_THRESHOLD_MS = 2000;
const DEFAULT_CANDLE_WINDOW_MS = 1000;
const DEFAULT_ATR_PERIOD = 13;
const DEFAULT_ATR_MULTIPLIER = '1.50';

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
    candles: [],
    snapshot: null,
    atrMultiplier: options.defaultAtrMultiplier ?? DEFAULT_ATR_MULTIPLIER,
    lastUpdatedAt: 0,
  };

  store.set(symbol, state);
  return state;
};

const updateCandles = (
  candleWindowMs: number,
  state: SymbolState,
  timestampMs: number,
  price: number,
): void => {
  const windowStart = Math.floor(timestampMs / candleWindowMs) * candleWindowMs;
  const windowEnd = windowStart + candleWindowMs;
  const ISO_TIMESTAMP = new Date(windowEnd).toISOString();

  const candles = state.candles;
  const last = candles[candles.length - 1];

  const high = price;
  const low = price;

  if (!last || new Date(last.timestamp).getTime() !== windowEnd) {
    candles.push({
      timestamp: ISO_TIMESTAMP,
      high,
      low,
      close: price,
    });
  } else {
    last.high = Math.max(last.high, high);
    last.low = Math.min(last.low, low);
    last.close = price;
  }
};

const computeAtr = (candles: MarketCandle[], period: number): number | null => {
  if (candles.length < period) {
    return null;
  }
  const subset = candles.slice(-period);
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
  getRecentCandles(symbol: Symbol, lookback: number): MarketCandle[];
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
  const candleWindowMs = options.candleWindowMs ?? DEFAULT_CANDLE_WINDOW_MS;
  const atrPeriod = options.atrPeriod ?? DEFAULT_ATR_PERIOD;

  const ingest = (symbol: Symbol, tick: MarketTickInput): MarketSnapshot => {
    const state = ensureState(symbol, store, options);
    const timestampMs = tick.timestamp ?? Date.now();
    const price = toNumber(tick.price) ?? 0;
    state.lastUpdatedAt = timestampMs;

    state.ticks.push({ timestamp: timestampMs, price });
    clampArray(state.ticks, maxTicks);

    updateCandles(candleWindowMs, state, timestampMs, price);
    clampArray(state.candles, maxCandles);

    const atr = computeAtr(state.candles, atrPeriod);
    const bid = toNumber(tick.bid);
    const ask = toNumber(tick.ask);
    if (tick.atrMultiplier != null) {
      state.atrMultiplier = String(tick.atrMultiplier);
    }

    const snapshot: MarketSnapshot = {
      symbol,
      lastPrice: toPriceString(price),
      bid: bid != null ? toPriceString(bid) : state.snapshot?.bid ?? null,
      ask: ask != null ? toPriceString(ask) : state.snapshot?.ask ?? null,
      atr13: atr != null ? toPriceString(atr) : state.snapshot?.atr13 ?? '0.00000000',
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

  const getRecentCandles = (symbol: Symbol, lookback: number): MarketCandle[] => {
    const state = store.get(symbol);
    if (!state) {
      return [];
    }
    return state.candles.slice(-lookback);
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

