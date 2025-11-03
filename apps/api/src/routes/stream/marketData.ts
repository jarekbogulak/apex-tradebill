import { SymbolSchema, type Symbol } from '@apex-tradebill/types';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { MarketDataPort, MarketMetadataPort } from '../../domain/ports/tradebillPorts.js';
import type { RingBuffer } from '../../realtime/ringBuffer.js';
import type { SampledTick } from '../../realtime/windowSampler.js';
import { createErrorResponse } from '../http.js';

interface MarketDataStreamRouteOptions {
  marketData: MarketDataPort;
  metadata: MarketMetadataPort;
  ringBuffer?: RingBuffer;
  intervalMs?: number;
  samplingWindowMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_SAMPLING_WINDOW_MS = 1000;

const parseSymbols = async (
  metadata: MarketMetadataPort,
  candidates: string[],
): Promise<Symbol[]> => {
  if (candidates.length === 0) {
    const allowlisted = await metadata.listAllowlistedSymbols();
    return allowlisted.slice(0, 1);
  }

  const resolved: Symbol[] = [];
  for (const candidate of candidates) {
    const parsed = SymbolSchema.safeParse(candidate);
    if (!parsed.success) {
      continue;
    }

    const info = await metadata.getMetadata(parsed.data);
    if (info && info.status === 'tradable') {
      resolved.push(info.symbol);
    }
  }

  return Array.from(new Set(resolved));
};

const resolveSnapshot = async (
  marketData: MarketDataPort,
  ringBuffer: RingBuffer | undefined,
  symbol: Symbol,
): Promise<ReturnType<MarketDataPort['getLatestSnapshot']>> => {
  if (ringBuffer) {
    const snapshot = ringBuffer.getSnapshot(symbol);
    if (snapshot) {
      return snapshot;
    }
  }
  return marketData.getLatestSnapshot(symbol);
};

interface SymbolStreamState {
  windowEnd?: number;
  stale?: boolean;
}

const sendSnapshots = async (
  ws: WebSocket,
  marketData: MarketDataPort,
  ringBuffer: RingBuffer | undefined,
  symbols: Symbol[],
  symbolStates: Map<Symbol, SymbolStreamState>,
  samplingWindowMs: number,
  log: FastifyBaseLogger,
) => {
  try {
    const snapshots = await Promise.all(
      symbols.map(async (symbol) => {
        const state = symbolStates.get(symbol) ?? {};
        let latestSample: SampledTick | undefined;

        if (ringBuffer) {
          const samples = ringBuffer.sampleTicks(symbol, samplingWindowMs);
          latestSample = samples[samples.length - 1];
        }

        const snapshot = await resolveSnapshot(marketData, ringBuffer, symbol);
        if (!snapshot) {
          return null;
        }

        const nextWindowEnd = latestSample?.windowEnd ?? state.windowEnd;
        const shouldSend =
          latestSample == null ||
          latestSample.windowEnd !== state.windowEnd ||
          snapshot.stale !== state.stale;

        if (!shouldSend) {
          return null;
        }

        symbolStates.set(symbol, {
          windowEnd: nextWindowEnd,
          stale: snapshot.stale,
        });

        return snapshot;
      }),
    );

    for (const snapshot of snapshots) {
      if (!snapshot) {
        continue;
      }

      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'market.snapshot',
            data: snapshot,
          }),
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish snapshot';
    log.warn({ err: error }, message);
  }
};

const extractSymbolsFromRequest = async (
  request: IncomingMessage,
  metadata: MarketMetadataPort,
): Promise<Symbol[]> => {
  const url = request.url ?? '/v1/stream/market-data';
  const parsedUrl = new URL(url, 'http://localhost');
  const symbols = parsedUrl.searchParams.getAll('symbols');
  return parseSymbols(metadata, symbols);
};

export const marketDataStreamRoute: FastifyPluginAsync<MarketDataStreamRouteOptions> = async (
  app,
  { marketData, metadata, ringBuffer, intervalMs = DEFAULT_INTERVAL_MS, samplingWindowMs = DEFAULT_SAMPLING_WINDOW_MS },
) => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (socket: WebSocket, request: IncomingMessage) => {
    const symbols = await extractSymbolsFromRequest(request, metadata);
    if (symbols.length === 0) {
      socket.close(1008, 'No tradable symbols requested');
      return;
    }

    let closed = false;
    const symbolStates = new Map<Symbol, SymbolStreamState>();

    const publish = async () => {
      if (closed) {
        return;
      }
      await sendSnapshots(
        socket,
        marketData,
        ringBuffer,
        symbols,
        symbolStates,
        samplingWindowMs,
        app.log,
      );
    };

    await publish();
    const timer = setInterval(() => {
      void publish();
    }, intervalMs);

    socket.on('close', () => {
      closed = true;
      clearInterval(timer);
    });
  });

  app.server.on('upgrade', (request, socket, head) => {
    const requestUrl = request.url ?? '/';
    const { pathname } = new URL(requestUrl, 'http://localhost');
    if (pathname !== '/v1/stream/market-data') {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  });

  app.addHook('onClose', (_instance, done) => {
    for (const client of wss.clients) {
      try {
        client.terminate();
      } catch {
        // Ignore termination errors during shutdown.
      }
    }
    try {
      wss.close();
    } catch {
      // Ignore if the server was already closed.
    }
    done();
  });

  app.get('/v1/stream/market-data', async (_request, reply) => {
    return reply
      .status(426)
      .send(createErrorResponse('UPGRADE_REQUIRED', 'WebSocket upgrade required for this endpoint'));
  });
};

export default marketDataStreamRoute;
