import Fastify, { type FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import { createMarketMetadataService } from './services/markets/marketMetadataService.js';
import {
  createSwappableTradeCalculationRepository,
  type TradeCalculationRepository,
} from './domain/trade-calculation/trade-calculation.entity.js';
import { createTradePreviewService } from './services/trades/previewService.js';
import { createTradeHistoryService } from './services/trades/historyService.js';
import { createSettingsService } from './services/settings/settingsService.js';
import { createInMemoryUserSettingsRepository } from './domain/user-settings/user-settings.entity.js';
import { createEquityService } from './services/accounts/equityService.js';
import type { MarketDataPort, MarketMetadataPort } from './domain/ports/tradebillPorts.js';
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
import authenticationPlugin from './plugins/authentication.js';
import observabilityPlugin from './plugins/observability.js';
import marketStreamPlugin from './plugins/marketStream.js';
import { env } from './config/env.js';
import { createDeviceAuthService } from './services/deviceAuthService.js';
import postDeviceRegisterRoute, { type DeviceAuthServiceRef } from './routes/postDeviceRegister.js';
import { createMarketInfrastructure } from './infra/marketData/infrastructure.js';
import { resolveTradeCalculationRepository } from './infra/database/tradeCalculations.js';
import { scheduleDatabaseRecovery } from './infra/database/recovery.js';
import { createJobScheduler, type TradeHistoryPruneJobHandle } from './jobs/scheduler.js';
import { closeSharedDatabasePool, type DatabasePool } from './infra/database/pool.js';
import { createInMemoryEquityPort } from './infra/accounts/inMemoryEquityPort.js';

type LogContext = Record<string, unknown>;

interface AppLoggerFacade {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const createAppLoggerFacade = (log: FastifyInstance['log']): AppLoggerFacade => ({
  info(message, context) {
    if (context) {
      log.info(context, message);
    } else {
      log.info(message);
    }
  },
  warn(message, context) {
    if (context) {
      log.warn(context, message);
    } else {
      log.warn(message);
    }
  },
  error(message, context) {
    if (context) {
      log.error(context, message);
    } else {
      log.error(message);
    }
  },
});

const createServices = ({
  marketMetadata,
  marketData,
  tradeCalculations,
  tradeCalculationsPersistent,
}: {
  marketMetadata: MarketMetadataPort;
  marketData: MarketDataPort;
  tradeCalculations: TradeCalculationRepository;
  tradeCalculationsPersistent: boolean;
}) => {
  const previewService = createTradePreviewService({
    marketData,
    metadata: marketMetadata,
    tradeCalculations,
  });

  const historyService = createTradeHistoryService({
    tradeCalculations,
    isPersistent: tradeCalculationsPersistent,
  });

  const userSettingsRepository = createInMemoryUserSettingsRepository();
  const settingsService = createSettingsService({
    repository: userSettingsRepository,
    metadata: marketMetadata,
  });

  const equityPort = createInMemoryEquityPort({ seedUserId: DEFAULT_USER_ID });
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
      level: env.server.logLevel,
    },
  });
  const appLogger = createAppLoggerFacade(app.log);
  const registerShutdownHook = (handler: () => Promise<void> | void) => {
    app.addHook('onClose', async () => {
      await handler();
    });
  };

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  const jwtSecret = env.auth.jwtSecret;
  const allowGuest = env.auth.allowGuest;

  await app.register(authenticationPlugin, {
    secret: jwtSecret,
    issuer: env.auth.issuer,
    audience: env.auth.audience,
    allowGuest,
  });

  await app.register(observabilityPlugin);

  const marketMetadataService = createMarketMetadataService();
  const infrastructure = await createMarketInfrastructure({
    logger: {
      info: appLogger.info,
      warn: appLogger.warn,
    },
    marketMetadata: marketMetadataService,
  });
  if (infrastructure.streaming && infrastructure.ringBuffer) {
    await app.register(marketStreamPlugin, {
      client: infrastructure.streaming.client,
      ringBuffer: infrastructure.ringBuffer,
      symbols: infrastructure.streaming.symbols,
    });
  }
  const { repository: tradeCalculationRepository, pool: tradeCalculationPool } =
    await resolveTradeCalculationRepository({
      logger: {
        info: appLogger.info,
        warn: appLogger.warn,
      },
    });
  const tradeCalculations = createSwappableTradeCalculationRepository(tradeCalculationRepository);
  const services = createServices({
    marketMetadata: marketMetadataService,
    marketData: infrastructure.marketData,
    tradeCalculations,
    tradeCalculationsPersistent: tradeCalculationPool != null,
  });
  const jobScheduler = createJobScheduler({
    logger: appLogger,
    registerShutdownHook,
  });
  const activationSecret = env.apex.credentials?.apiSecret;
  const deviceAuthServiceRef: DeviceAuthServiceRef = {
    current: null,
  };

  const attachDeviceAuthService = (pool: DatabasePool | null) => {
    if (!pool) {
      deviceAuthServiceRef.current = null;
      return;
    }
    if (!activationSecret) {
      app.log.warn('APEX_OMNI_API_SECRET missing – device activation disabled');
      deviceAuthServiceRef.current = null;
      return;
    }
    deviceAuthServiceRef.current = createDeviceAuthService({
      pool,
      activationSecret,
      jwtSecret,
      jwtIssuer: env.auth.issuer,
      jwtAudience: env.auth.audience,
    });
  };

  let pruneJobHandle: TradeHistoryPruneJobHandle | null = null;
  let dbShutdownHookRegistered = false;
  const onPersistentPoolReady = async (pool: DatabasePool) => {
    services.historyService.setPersistent(true);
    attachDeviceAuthService(pool);
    if (!dbShutdownHookRegistered) {
      registerShutdownHook(async () => {
        await closeSharedDatabasePool();
      });
      dbShutdownHookRegistered = true;
    }
    pruneJobHandle = await jobScheduler.scheduleTradeHistoryPrune(pool, pruneJobHandle);
  };

  if (tradeCalculationPool) {
    await onPersistentPoolReady(tradeCalculationPool);
  } else if (env.database.allowInMemory) {
    scheduleDatabaseRecovery({
      repository: tradeCalculations,
      onPersistentResourcesReady: onPersistentPoolReady,
      logger: {
        info: appLogger.info,
        warn: appLogger.warn,
      },
      registerShutdownHook,
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
    deviceAuthServiceRef,
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

const registerGracefulShutdown = (server: FastifyInstance, shutdownTimeoutMs: number): void => {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  let closing = false;
  const listeners = new Map<NodeJS.Signals, () => void>();

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
  const { port, host } = env.server;

  const server = await buildServer();
  registerGracefulShutdown(server, env.server.shutdownTimeoutMs);

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
