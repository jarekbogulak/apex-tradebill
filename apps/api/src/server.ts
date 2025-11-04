import './config/loadEnv.js';
import Fastify, { type FastifyInstance } from 'fastify';
import { type MarketSnapshot, type Symbol as TradingSymbol, type Timeframe } from '@apex-tradebill/types';
import { fileURLToPath } from 'node:url';
import { createMarketMetadataService } from './services/markets/marketMetadataService.js';
import {
  createInMemoryTradeCalculationRepository,
  type TradeCalculationRepository,
} from './domain/trade-calculation/trade-calculation.entity.js';
import { createPostgresTradeCalculationRepository } from './domain/trade-calculation/trade-calculation.repository.pg.js';
import { createTradePreviewService } from './services/trades/previewService.js';
import { createTradeHistoryService } from './services/trades/historyService.js';
import { createSettingsService } from './services/settings/settingsService.js';
import { createInMemoryUserSettingsRepository } from './domain/user-settings/user-settings.entity.js';
import { createEquityService } from './services/accounts/equityService.js';
import type {
  AccountEquityPort,
  MarketCandle,
  MarketDataPort,
  MarketMetadataPort,
} from './domain/ports/tradebillPorts.js';
import getSymbolRoute from './routes/markets/getSymbol.js';
import postPreviewRoute from './routes/trades/postPreview.js';
import postExecuteRoute from './routes/trades/postExecute.js';
import getHistoryRoute from './routes/trades/getHistory.js';
import postHistoryImportRoute from './routes/trades/postHistoryImport.js';
import getSettingsRoute from './routes/settings/getSettings.js';
import patchSettingsRoute from './routes/settings/patchSettings.js';
import getEquityRoute from './routes/accounts/getEquity.js';
import marketDataStreamRoute from './routes/stream/marketData.js';
import { DEFAULT_USER_ID } from './routes/http.js';
import { createApeXOmniClient } from './clients/apexOmniClient.js';
import { createRingBuffer } from './realtime/ringBuffer.js';
import marketStreamPlugin from './plugins/marketStream.js';
import authenticationPlugin from './plugins/authentication.js';
import observabilityPlugin from './plugins/observability.js';
import { createRingBufferMarketDataPort } from './infra/marketData/ringBufferAdapter.js';
import type { RingBuffer } from './realtime/ringBuffer.js';
import {
  closeSharedDatabasePool,
  getSharedDatabasePool,
  runPendingMigrations,
  type DatabasePool,
} from './infra/database/pool.js';
import {
  createPruneTradeHistoryJob,
  type PruneTradeHistoryJobLogger,
  type ScheduledJobHandle,
} from './jobs/pruneTradeHistory.js';
import { resolveApeXCredentials } from './config/apexConfig.js';
import { createDeviceAuthService } from './services/deviceAuthService.js';
import postDeviceRegisterRoute from './routes/postDeviceRegister.js';

const BASE_PRICES: Record<TradingSymbol, number> = {
  'BTC-USDT': 65_000,
  'ETH-USDT': 3_200,
};

const formatPrice = (value: number, fractionDigits = 2): string => {
  return value.toFixed(fractionDigits);
};

const generateCandleSeries = (symbol: TradingSymbol, count = 256): MarketCandle[] => {
  const base = BASE_PRICES[symbol] ?? 1_000;
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

const TIMEFRAME_MULTIPLIERS: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
};

const aggregateCandles = (
  series: MarketCandle[],
  multiplier: number,
): MarketCandle[] => {
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

const CANDLE_INTERVAL_MS = 60_000;
const MAX_SERIES_LENGTH = 512;

interface SeriesState {
  candles: MarketCandle[];
  lastTimestampMs: number;
  seed: number;
}

const createInMemoryMarketDataPort = (): MarketDataPort => {
  const seriesBySymbol = new Map<TradingSymbol, SeriesState>();

  const ensureState = (symbol: TradingSymbol): SeriesState => {
    let state = seriesBySymbol.get(symbol);
    if (!state) {
      const candles = generateCandleSeries(symbol);
      const lastTimestamp = candles[candles.length - 1]?.timestamp ?? new Date().toISOString();
      state = {
        candles,
        lastTimestampMs: Date.parse(lastTimestamp),
        seed: Math.random() * 1000,
      };
      seriesBySymbol.set(symbol, state);
    }
    return state;
  };

  const appendSyntheticCandles = (state: SeriesState): void => {
    const now = Date.now();
    const intervals = Math.max(
      0,
      Math.floor((now - state.lastTimestampMs) / CANDLE_INTERVAL_MS),
    );

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

      const lastClose = state.candles[state.candles.length - 1]?.close ?? BASE_PRICES[symbol] ?? 1_000;
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

const createInMemoryEquityPort = (): AccountEquityPort => {
  const store = new Map<string, { equity: string; lastSyncedAt: string; source: 'connected' | 'manual' }>();

  store.set(DEFAULT_USER_ID, {
    source: 'connected',
    equity: '25000.00',
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    async getEquity(userId) {
      const snapshot = store.get(userId);
      if (!snapshot) {
        return null;
      }
      return {
        source: snapshot.source,
        equity: snapshot.equity,
        lastSyncedAt: snapshot.lastSyncedAt,
      };
    },
    async setManualEquity(userId, equity) {
      const updated = {
        source: 'manual' as const,
        equity,
        lastSyncedAt: new Date().toISOString(),
      };
      store.set(userId, updated);
      return updated;
    },
  };
};

interface MarketInfrastructure {
  marketData: MarketDataPort;
  ringBuffer?: RingBuffer;
}

const createMarketInfrastructure = async (
  app: FastifyInstance,
  marketMetadata: MarketMetadataPort,
): Promise<MarketInfrastructure> => {
  const credentials = resolveApeXCredentials();
  if (!credentials) {
    app.log.warn('ApeX Omni credentials missing – using in-memory market data');
    return {
      marketData: createInMemoryMarketDataPort(),
    };
  }

  const ringBuffer = createRingBuffer();
  const client = createApeXOmniClient({
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
    passphrase: credentials.passphrase,
    environment: credentials.environment,
    restBaseUrl: credentials.restUrl,
    wsBaseUrl: credentials.wsUrl,
  });

  const allowlisted = await marketMetadata.listAllowlistedSymbols();
  const symbols = allowlisted.length > 0 ? allowlisted : (Object.keys(BASE_PRICES) as TradingSymbol[]);

  const probeSymbol = symbols[0] ?? ('BTC-USDT' as TradingSymbol);
  try {
    const snapshot = await client.getMarketSnapshot(probeSymbol);
    if (!snapshot) {
      throw new Error(`Received empty snapshot for ${probeSymbol}`);
    }
  } catch (error) {
    app.log.warn(
      { err: error, probeSymbol },
      'apex.omni.snapshot_failed_falling_back_to_in_memory_market_data',
    );
    return {
      marketData: createInMemoryMarketDataPort(),
    };
  }

  await app.register(marketStreamPlugin, {
    client,
    ringBuffer,
    symbols,
  });

  const marketData = createRingBufferMarketDataPort({
    ringBuffer,
    client,
  });

  return {
    marketData,
    ringBuffer,
  };
};

interface ResolvedRepository {
  repository: TradeCalculationRepository;
  pool: DatabasePool | null;
}

const resolveTradeCalculationRepository = async (
  app: FastifyInstance,
): Promise<ResolvedRepository> => {
  try {
    const pool = await getSharedDatabasePool();
    await runPendingMigrations(pool);
    app.log.info('database.connected');

    app.addHook('onClose', async () => {
      await closeSharedDatabasePool();
    });

    return {
      repository: createPostgresTradeCalculationRepository(pool),
      pool,
    };
  } catch (error) {
    app.log.warn(
      { err: error },
      'database.connection_failed_using_in_memory_repository',
    );
    return {
      repository: createInMemoryTradeCalculationRepository(),
      pool: null,
    };
  }
};

const createServices = ({
  marketMetadata,
  marketData,
  tradeCalculations,
}: {
  marketMetadata: MarketMetadataPort;
  marketData: MarketDataPort;
  tradeCalculations: TradeCalculationRepository;
}) => {
  const previewService = createTradePreviewService({
    marketData,
    metadata: marketMetadata,
    tradeCalculations,
  });

  const historyService = createTradeHistoryService({
    tradeCalculations,
  });

  const userSettingsRepository = createInMemoryUserSettingsRepository();
  const settingsService = createSettingsService({
    repository: userSettingsRepository,
    metadata: marketMetadata,
  });

  const equityPort = createInMemoryEquityPort();
  const equityService = createEquityService({ equityPort });

  return {
    marketData,
    previewService,
    historyService,
    settingsService,
    equityService,
    tradeCalculations,
  };
};

export const buildServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  const jwtSecret = process.env.JWT_SECRET;
  const allowGuest =
    jwtSecret == null || (process.env.APEX_TRADEBILL_AUTH_ALLOW_GUEST ?? 'true') === 'true';

  await app.register(authenticationPlugin, {
    secret: jwtSecret ?? 'development-secret',
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    allowGuest,
  });

  await app.register(observabilityPlugin);

  const marketMetadataService = createMarketMetadataService();
  const infrastructure = await createMarketInfrastructure(app, marketMetadataService);
  const { repository: tradeCalculationRepository, pool: tradeCalculationPool } =
    await resolveTradeCalculationRepository(app);
  const services = createServices({
    marketMetadata: marketMetadataService,
    marketData: infrastructure.marketData,
    tradeCalculations: tradeCalculationRepository,
  });
  const activationSecret = process.env.APEX_OMNI_API_SECRET;
  const deviceAuthService =
    tradeCalculationPool != null && activationSecret
      ? createDeviceAuthService({
          pool: tradeCalculationPool,
          activationSecret,
          jwtSecret: jwtSecret ?? 'development-secret',
          jwtIssuer: process.env.JWT_ISSUER,
          jwtAudience: process.env.JWT_AUDIENCE,
        })
      : null;
  if (tradeCalculationPool && !activationSecret) {
    app.log.warn('APEX_OMNI_API_SECRET missing – device activation disabled');
  }

  if (tradeCalculationPool) {
    const logger: PruneTradeHistoryJobLogger = {
      info(message, context) {
        if (context) {
          app.log.info(context, message);
        } else {
          app.log.info(message);
        }
      },
      error(message, context) {
        if (context) {
          app.log.error(context, message);
        } else {
          app.log.error(message);
        }
      },
    };

    const pruneJob = createPruneTradeHistoryJob(tradeCalculationPool, { logger });
    let pruneJobHandle: ScheduledJobHandle | null = null;

    try {
      const result = await pruneJob.run();
      app.log.info(
        { removed: result.removed, cutoffIso: result.cutoffIso },
        'trade_history.prune_startup_run',
      );
    } catch (error) {
      app.log.error({ err: error }, 'trade_history.prune_startup_failed');
    }

    pruneJobHandle = pruneJob.schedule();

    app.addHook('onClose', (_instance, done) => {
      pruneJobHandle?.cancel();
      done();
    });
  }

  await app.register(getSymbolRoute, {
    metadata: marketMetadataService,
  });

  await app.register(postPreviewRoute, {
    previewService: services.previewService,
  });

  await app.register(postExecuteRoute, {
    previewService: services.previewService,
  });

  await app.register(postDeviceRegisterRoute, {
    deviceAuthService,
  });

  await app.register(postHistoryImportRoute, {
    tradeCalculations: services.tradeCalculations,
  });

  await app.register(getHistoryRoute, {
    historyService: services.historyService,
  });

  await app.register(getSettingsRoute, {
    settingsService: services.settingsService,
  });

  await app.register(patchSettingsRoute, {
    settingsService: services.settingsService,
  });

  await app.register(getEquityRoute, {
    equityService: services.equityService,
  });

  await app.register(marketDataStreamRoute, {
    marketData: services.marketData,
    metadata: marketMetadataService,
    ringBuffer: infrastructure.ringBuffer,
  });

  return app;
};

const registerGracefulShutdown = (server: FastifyInstance): void => {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  let closing = false;
  const listeners = new Map<NodeJS.Signals, () => void>();
  const shutdownTimeoutMs = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '', 10) || 1000;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) {
      server.log.warn({ signal }, 'shutdown.already_in_progress');
      return;
    }

    closing = true;
    server.log.info({ signal }, 'shutdown.signal_received');

    const closeServer = async () => {
      try {
        // Fastify exposes the underlying Node server; force-close lingering sockets if supported.
        const rawServer = server.server as unknown as {
          closeIdleConnections?: () => void;
          closeAllConnections?: () => void;
        };
        rawServer.closeIdleConnections?.();
        rawServer.closeAllConnections?.();
      } catch (forceError) {
        server.log.warn({ err: forceError }, 'shutdown.force_close_attempt_failed');
      }

      await server.close();
    };

    let timeoutHandle: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`shutdown timeout (${shutdownTimeoutMs}ms)`));
      }, shutdownTimeoutMs);
      timeoutHandle.unref();
    });

    try {
      server.log.info({ timeoutMs: shutdownTimeoutMs }, 'shutdown.closing_server');
      const closingPromise = closeServer();
      closingPromise.catch(() => {
        // Prevent unhandled rejection noise if we force-exit before Fastify closes.
      });
      await Promise.race([closingPromise, timeoutPromise]);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      server.log.info('shutdown.server_closed');
      process.exit(0);
    } catch (error) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      server.log.error({ err: error }, 'shutdown.failed_to_close');
      try {
        const rawServer = server.server as unknown as {
          closeIdleConnections?: () => void;
          closeAllConnections?: () => void;
        };
        rawServer.closeIdleConnections?.();
        rawServer.closeAllConnections?.();
      } catch (forceError) {
        server.log.warn({ err: forceError }, 'shutdown.force_close_after_failure_failed');
      }
      // Attempt a last-resort force exit to prevent the dev runner from hanging.
      setImmediate(() => {
        process.exit(1);
      });
    }
  };

  for (const signal of signals) {
    const handler = () => {
      void shutdown(signal);
    };
    listeners.set(signal, handler);
    process.once(signal, handler);
  }

  server.addHook('onClose', () => {
    for (const [signal, handler] of listeners.entries()) {
      process.removeListener(signal, handler);
    }
  });
};

const start = async () => {
  const port = Number.parseInt(process.env.PORT ?? '4000', 10);
  const host = process.env.HOST ?? '0.0.0.0';

  const server = await buildServer();
  registerGracefulShutdown(server);

  try {
    await server.listen({ port, host });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return entry === fileURLToPath(import.meta.url);
};

if (isDirectRun()) {
  void start();
}
