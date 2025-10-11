import { SymbolSchema, type Symbol } from '@apex-tradebill/types';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { MarketDataPort, MarketMetadataPort } from '../../domain/ports/tradebillPorts.js';
import { createErrorResponse } from '../http.js';

interface MarketDataStreamRouteOptions {
  marketData: MarketDataPort;
  metadata: MarketMetadataPort;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;

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

const sendSnapshots = async (
  ws: WebSocket,
  marketData: MarketDataPort,
  symbols: Symbol[],
  log: FastifyBaseLogger,
) => {
  try {
    const snapshots = await Promise.all(symbols.map((symbol) => marketData.getLatestSnapshot(symbol)));
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
  { marketData, metadata, intervalMs = DEFAULT_INTERVAL_MS },
) => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (socket: WebSocket, request: IncomingMessage) => {
    const symbols = await extractSymbolsFromRequest(request, metadata);
    if (symbols.length === 0) {
      socket.close(1008, 'No tradable symbols requested');
      return;
    }

    let closed = false;

    const publish = async () => {
      if (closed) {
        return;
      }
      await sendSnapshots(socket, marketData, symbols, app.log);
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
    wss.close(() => done());
  });

  app.get('/v1/stream/market-data', async (_request, reply) => {
    return reply
      .status(426)
      .send(createErrorResponse('UPGRADE_REQUIRED', 'WebSocket upgrade required for this endpoint'));
  });
};

export default marketDataStreamRoute;
