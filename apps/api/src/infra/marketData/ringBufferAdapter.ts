import type { MarketSnapshot, Symbol, Timeframe } from '@apex-tradebill/types';
import type { ApeXOmniClient } from '../../clients/apexOmniClient.js';
import type { MarketDataPort, MarketCandle } from '../../domain/ports/tradebillPorts.js';
import type { RingBuffer } from '../../realtime/ringBuffer.js';

const toNumber = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toTimestampMs = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const toTick = (snapshot: MarketSnapshot) => ({
  price: Number.parseFloat(snapshot.lastPrice),
  bid: toNumber(snapshot.bid ?? null),
  ask: toNumber(snapshot.ask ?? null),
  atrMultiplier: snapshot.atrMultiplier,
  timestamp: toTimestampMs(snapshot.serverTimestamp),
});

export interface RingBufferMarketDataPortDeps {
  ringBuffer: RingBuffer;
  client: ApeXOmniClient;
}

export const createRingBufferMarketDataPort = ({
  ringBuffer,
  client,
}: RingBufferMarketDataPortDeps): MarketDataPort => {
  const getLatestSnapshot = async (symbol: Symbol): Promise<MarketSnapshot | null> => {
    const snapshot = ringBuffer.getSnapshot(symbol);
    if (snapshot) {
      return snapshot;
    }

    const fallback = await client.getMarketSnapshot(symbol);
    if (!fallback) {
      return null;
    }

    ringBuffer.ingest(symbol, toTick(fallback));
    return ringBuffer.getSnapshot(symbol);
  };

  const getRecentCandles = async (
    symbol: Symbol,
    timeframe: Timeframe,
    lookback: number,
  ): Promise<MarketCandle[]> => {
    const fromBuffer = ringBuffer.getRecentCandles(symbol, timeframe, lookback);
    if (fromBuffer.length >= lookback) {
      return fromBuffer.slice(-lookback);
    }

    const fallback = await client.getRecentCandles(symbol, timeframe, lookback);
    return fallback.slice(-lookback);
  };

  return {
    getLatestSnapshot,
    getRecentCandles,
  };
};
