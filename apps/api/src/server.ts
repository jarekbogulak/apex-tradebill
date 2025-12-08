import Fastify, { type FastifyInstance } from 'fastify';
import { pathToFileURL } from 'node:url';
import { createMarketMetadataService } from '@api/domain/markets/marketMetadataService.js';
import { createSwappableTradeCalculationRepository } from '@api/domain/trade-calculation/trade-calculation.entity.js';
import getSymbolRoute from '@api/adapters/http/fastify/markets/getSymbol.js';
import postPreviewRoute from '@api/adapters/http/fastify/trades/postPreview.js';
import postExecuteRoute from '@api/adapters/http/fastify/trades/postExecute.js';
import getHistoryRoute from '@api/adapters/http/fastify/trades/getHistory.js';
import postHistoryImportRoute from '@api/adapters/http/fastify/trades/postHistoryImport.js';
import getSettingsRoute from '@api/adapters/http/fastify/settings/getSettings.js';
import patchSettingsRoute from '@api/adapters/http/fastify/settings/patchSettings.js';
import getEquityRoute from '@api/adapters/http/fastify/accounts/getEquity.js';
import marketDataStreamRoute from '@api/adapters/http/fastify/stream/marketData.js';
import postDeviceRegisterRoute, {
  type DeviceAuthServiceRef,
} from '@api/adapters/http/fastify/auth/postDeviceRegister.js';
import { DEFAULT_USER_ID } from '@api/adapters/http/fastify/shared/http.js';
import authenticationPlugin from '@api/plugins/authentication.js';
import observabilityPlugin from '@api/plugins/observability.js';
import omniSecretsPlugin from '@api/plugins/omniSecrets.js';
import errorHandlerPlugin from '@api/plugins/errorHandler.js';
import marketStreamPlugin from '@api/plugins/marketStream.js';
import { rebuildEnv, env, ConfigError } from '@api/config/env.js';
import { createDeviceAuthService } from '@api/adapters/security/deviceAuthService.js';
import { createMarketInfrastructure } from '@api/adapters/streaming/marketData/infrastructure.js';
import { resolveTradeCalculationRepository } from '@api/adapters/persistence/trade-calculations/resolveTradeCalculationRepository.js';
import { scheduleDatabaseRecovery } from '@api/adapters/persistence/providers/postgres/recovery.js';
import { createJobScheduler, type TradeHistoryPruneJobHandle } from '@api/adapters/jobs/scheduler.js';
import {
  closeSharedDatabasePool,
  type DatabasePool,
} from '@api/adapters/persistence/providers/postgres/pool.js';
import { buildAppDeps } from '@api/config/appDeps.js';
import { makePruneTradeHistory } from '@api/domain/trading/pruneTradeHistory.usecase.js';

type LogContext = Record<string, unknown>;

interface AppLoggerFacade {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export interface BuildServerOverrides {
  createDeviceAuthService?: typeof createDeviceAuthService;
  createMarketInfrastructure?: typeof createMarketInfrastructure;
  createJobScheduler?: typeof createJobScheduler;
  omniSecretsPlugin?: typeof omniSecretsPlugin;
  resolveTradeCalculationRepository?: typeof resolveTradeCalculationRepository;
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

export const buildServer = async (
  overrides: BuildServerOverrides = {},
): Promise<FastifyInstance> => {
  // Rebuild env in tests when overrides are applied
  if (process.env.NODE_ENV === 'test') {
    Object.assign(env, rebuildEnv());
  }
  const isNonProd = process.env.NODE_ENV !== 'production';
  const pointsAtProdGsm =
    process.env.APEX_OMNI_ENVIRONMENT === 'prod' && Boolean(process.env.GCP_PROJECT_ID);
  if (isNonProd && pointsAtProdGsm) {
    throw new ConfigError(
      'Non-production environments cannot point at production Google Secret Manager secrets. Update GCP_PROJECT_ID or APEX_OMNI_ENVIRONMENT.',
    );
  }

  const redactedLogPaths = [
    'req.headers.apex-api-key',
    'req.headers.apex-signature',
    'req.headers.apex-passphrase',
    'req.headers.apex-omni-api-key',
    'req.headers.apex-omni-api-secret',
    'req.headers.apex-omni-api-passphrase',
    'body.apexOmni.apiSecret',
    'body.apexOmni.apiKey',
    'body.apexOmni.passphrase',
    'body.apexOmni.l2Seed',
  ];

  const app = Fastify({
    logger: {
      level: env.server.logLevel,
      redact: {
        paths: redactedLogPaths,
        remove: true,
      },
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
  let activationSecret: string | null = env.apex.credentials?.apiSecret ?? null;

  await app.register(authenticationPlugin, {
    secret: jwtSecret,
    issuer: env.auth.issuer,
    audience: env.auth.audience,
    allowGuest,
    unauthenticatedPaths: ['/v1/auth/device/register'],
  });

  await app.register(observabilityPlugin);
  const resolveOmniSecretsPlugin = overrides.omniSecretsPlugin ?? omniSecretsPlugin;
  await app.register(resolveOmniSecretsPlugin);
  if (!activationSecret && app.omniSecrets) {
    try {
      const result = await app.omniSecrets.getSecretValue('trading_client_secret');
      activationSecret = result.value;
      app.log.info('Loaded activation secret from Omni Secrets (trading_client_secret)');
    } catch (error) {
      app.log.warn(
        { err: error },
        'Failed to load trading_client_secret from Omni Secrets; device activation remains disabled',
      );
    }
  }

  const marketMetadataService = createMarketMetadataService();
  const buildMarketInfrastructure = overrides.createMarketInfrastructure ?? createMarketInfrastructure;
  const infrastructure = await buildMarketInfrastructure({
    logger: {
      info: appLogger.info,
      warn: appLogger.warn,
    },
    marketMetadata: marketMetadataService,
    omniSecrets: app.omniSecrets,
  });
  if (infrastructure.streaming && infrastructure.ringBuffer) {
    await app.register(marketStreamPlugin, {
      client: infrastructure.streaming.client,
      ringBuffer: infrastructure.ringBuffer,
      symbols: infrastructure.streaming.symbols,
    });
  }
  const resolveTradeCalculations =
    overrides.resolveTradeCalculationRepository ?? resolveTradeCalculationRepository;
  const { repository: tradeCalculationRepository, pool: tradeCalculationPool } =
    await resolveTradeCalculations({
      logger: {
        info: appLogger.info,
        warn: appLogger.warn,
      },
    });
  const tradeCalculations = createSwappableTradeCalculationRepository(tradeCalculationRepository);
  const services = buildAppDeps({
    marketMetadata: marketMetadataService,
    marketData: infrastructure.marketData,
    tradeCalculations,
    tradeCalculationsPersistent: tradeCalculationPool != null,
    seedEquityUserId: DEFAULT_USER_ID,
  });
  const pruneTradeHistory = makePruneTradeHistory({ repository: tradeCalculations });
  const buildJobScheduler = overrides.createJobScheduler ?? createJobScheduler;
  const jobScheduler = buildJobScheduler({
    logger: appLogger,
    registerShutdownHook,
  });
  const deviceAuthServiceRef: DeviceAuthServiceRef = {
    current: null,
  };

  const attachDeviceAuthService = (pool: DatabasePool | null) => {
    if (!pool) {
      deviceAuthServiceRef.current = null;
      return;
    }
    if (!activationSecret) {
      app.log.warn(
        'Device activation secret missing (APEX_OMNI_API_SECRET or trading_client_secret via Omni Secrets) – device activation disabled',
      );
      deviceAuthServiceRef.current = null;
      return;
    }
    const buildDeviceAuthService = overrides.createDeviceAuthService ?? createDeviceAuthService;
    deviceAuthServiceRef.current = buildDeviceAuthService({
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
    services.tradeHistory.setPersistent(true);
    attachDeviceAuthService(pool);
    if (!dbShutdownHookRegistered) {
      registerShutdownHook(async () => {
        await closeSharedDatabasePool();
      });
      dbShutdownHookRegistered = true;
    }
    pruneJobHandle = await jobScheduler.scheduleTradeHistoryPrune(
      pruneTradeHistory,
      pruneJobHandle,
    );
  };

  const forceInMemoryDb = process.env.APEX_FORCE_IN_MEMORY_DB === 'true';

  if (tradeCalculationPool) {
    await onPersistentPoolReady(tradeCalculationPool);
  } else if (env.database.allowInMemory && !forceInMemoryDb) {
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
    previewTrade: services.previewTrade,
  });

  await app.register(postExecuteRoute, {
    executeTrade: services.executeTrade,
  });

  await app.register(postDeviceRegisterRoute, {
    deviceAuthServiceRef,
  });

  await app.register(errorHandlerPlugin);

  await app.register(postHistoryImportRoute, {
    importTradeHistory: services.importTradeHistory,
  });

  await app.register(getHistoryRoute, {
    tradeHistory: services.tradeHistory,
  });

  await app.register(getSettingsRoute, {
    getUserSettings: services.getUserSettings,
  });

  await app.register(patchSettingsRoute, {
    updateUserSettings: services.updateUserSettings,
  });

  await app.register(getEquityRoute, {
    getEquitySnapshot: services.getEquitySnapshot,
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

const isDirectRun =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
const shouldStart = process.env.RUN_OMNI_SERVER !== 'false';

if (isDirectRun && shouldStart) {
  void start();
}
