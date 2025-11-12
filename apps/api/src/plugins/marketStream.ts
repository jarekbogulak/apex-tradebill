import { SymbolSchema, type Symbol } from '@apex-tradebill/types';
import type { FastifyPluginAsync } from 'fastify';
import type {
  ApeXOmniClient,
  MarketStreamConnection,
} from '../adapters/streaming/providers/apexOmni/client.js';
import type { RingBuffer } from '../adapters/streaming/realtime/ringBuffer.js';

export interface MarketStreamPluginOptions {
  client: ApeXOmniClient;
  ringBuffer: RingBuffer;
  symbols: Symbol[];
}

interface ParsedStreamUpdate {
  symbol: Symbol;
  lastPrice: number;
  bid?: number | null;
  ask?: number | null;
  atrMultiplier?: string | null;
  serverTimestamp: number;
}

const toNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeSymbol = (value: string): string => {
  if (value.includes('-')) {
    return value;
  }
  if (value.endsWith('USDT')) {
    const base = value.slice(0, -4);
    return `${base}-USDT`;
  }
  return value;
};

const extractSymbolFromTopic = (topic: string | undefined): string | null => {
  if (!topic) {
    return null;
  }
  const parts = topic.split('.');
  const tail = parts[parts.length - 1];
  if (!tail) {
    return null;
  }
  return normalizeSymbol(tail);
};

const resolveTimestampMs = (value: unknown): number => {
  if (typeof value === 'number') {
    if (value > 10_000_000_000_000) {
      return Math.floor(value / 1000);
    }
    if (value < 1_000_000_000_000 && value > 1_000_000_000) {
      return Math.floor(value * 1000);
    }
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return resolveTimestampMs(numeric);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

const toMessageObject = (payload: unknown): Record<string, unknown> | null => {
  if (payload == null) {
    return null;
  }
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (payload instanceof Buffer) {
    try {
      return JSON.parse(payload.toString('utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (ArrayBuffer.isView(payload)) {
    try {
      return JSON.parse(Buffer.from(payload.buffer).toString('utf-8')) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }
  return null;
};

const parseStreamUpdate = (payload: unknown): ParsedStreamUpdate | null => {
  const message = toMessageObject(payload);
  if (!message) {
    return null;
  }

  const topic = typeof message.topic === 'string' ? message.topic : undefined;
  const dataCandidate = message.data ?? message;
  if (typeof dataCandidate !== 'object' || dataCandidate == null) {
    return null;
  }
  const data = dataCandidate as Record<string, unknown>;

  const rawSymbol =
    (typeof data.symbol === 'string' ? data.symbol : undefined) ??
    (typeof message.symbol === 'string' ? message.symbol : undefined) ??
    extractSymbolFromTopic(topic) ??
    null;
  if (!rawSymbol) {
    return null;
  }

  const symbolResult = SymbolSchema.safeParse(normalizeSymbol(rawSymbol));
  if (!symbolResult.success) {
    return null;
  }

  const lastPrice =
    toNumber(data.lastPrice) ??
    toNumber(data.price) ??
    toNumber((data as { tick?: { lastPrice?: unknown } }).tick?.lastPrice);
  if (lastPrice == null) {
    return null;
  }

  const bid =
    toNumber(data.bid) ?? toNumber((data as { tick?: { bid?: unknown } }).tick?.bid) ?? null;
  const ask =
    toNumber(data.ask) ?? toNumber((data as { tick?: { ask?: unknown } }).tick?.ask) ?? null;
  const atrMultiplierCandidate =
    (data.atrMultiplier as string | number | null | undefined) ??
    ((data as { tick?: { atrMultiplier?: unknown } }).tick?.atrMultiplier as
      | string
      | number
      | null
      | undefined) ??
    null;

  const timestampCandidate =
    data.serverTimestamp ??
    data.timestamp ??
    (message as { timestamp?: unknown }).timestamp ??
    (message as { ts?: unknown }).ts;
  const serverTimestamp = resolveTimestampMs(timestampCandidate);

  return {
    symbol: symbolResult.data,
    lastPrice,
    bid,
    ask,
    atrMultiplier: atrMultiplierCandidate != null ? String(atrMultiplierCandidate) : null,
    serverTimestamp,
  };
};

export const marketStreamPlugin: FastifyPluginAsync<MarketStreamPluginOptions> = async (
  app,
  { client, ringBuffer, symbols },
) => {
  let connection: MarketStreamConnection | null = null;
  let closed = false;

  const handleMessage = (raw: unknown) => {
    const parsed = parseStreamUpdate(raw);
    if (!parsed) {
      return;
    }

    ringBuffer.ingest(parsed.symbol, {
      price: parsed.lastPrice,
      bid: parsed.bid,
      ask: parsed.ask,
      atrMultiplier: parsed.atrMultiplier,
      timestamp: parsed.serverTimestamp,
    });
  };

  app.addHook('onReady', async () => {
    app.log.info({ symbols }, 'market_stream.connecting');

    connection = client.connectMarketStream({
      symbols,
      onOpen: () => {
        app.log.info('market_stream.connected');
        app.observability?.incrementCounter('market_stream_connections_total');
      },
      onMessage: handleMessage,
      onError: (error) => {
        app.log.error({ err: error }, 'market_stream.error');
        app.observability?.incrementCounter('market_stream_errors_total');
      },
      onClose: (code, reason) => {
        if (closed) {
          return;
        }
        app.log.warn({ code, reason: reason?.toString('utf-8') ?? '' }, 'market_stream.closed');
        app.observability?.incrementCounter('market_stream_disconnects_total', {
          code,
        });
      },
    });
  });

  app.addHook('onClose', (_instance, done) => {
    closed = true;
    if (connection) {
      try {
        connection.close();
      } catch (error) {
        app.log.error({ err: error }, 'market_stream.close_error');
      } finally {
        connection = null;
      }
    }
    done();
  });
};

export default marketStreamPlugin;
