import type { FastifyPluginAsync } from 'fastify';
import type {
  SecretManagerServiceClient,
  protos as SecretManagerProtos,
} from '@google-cloud/secret-manager';

type AccessSecretVersionResult = [
  SecretManagerProtos.google.cloud.secretmanager.v1.IAccessSecretVersionResponse,
  SecretManagerProtos.google.cloud.secretmanager.v1.IAccessSecretVersionRequest | undefined,
  Record<string, never> | undefined,
];
import { env } from '../config/env.js';
import { buildDatabasePoolOptions } from '../config/database.js';
import { getSharedDatabasePool } from '../adapters/persistence/providers/postgres/pool.js';
import { runMigrations } from '../adapters/persistence/providers/postgres/migrations.js';
import { createOmniSecretRepository } from '@api/modules/omniSecrets/repository.js';
import { createInMemoryOmniSecretRepository } from '@api/modules/omniSecrets/repository.inMemory.js';
import { OmniSecretCache } from '@api/modules/omniSecrets/cache.js';
import { GsmSecretManagerClient } from '@api/modules/omniSecrets/gsmClient.js';
import { createOmniSecretService } from '@api/modules/omniSecrets/service.js';
import omniStatusRoute from '@api/adapters/http/fastify/omni/status.js';
import omniRotationPreviewRoute from '@api/adapters/http/fastify/omni/rotationPreview.js';
import omniCacheRefreshRoute from '@api/adapters/http/fastify/omni/cacheRefresh.js';
import omniBreakGlassRoute from '@api/adapters/http/fastify/omni/breakGlass.js';
import { createOmniSecretsTelemetry } from '@api/observability/omniSecretsTelemetry.js';
import { createOmniSecretsAlerts } from '@api/observability/alerts/omniSecrets.js';
import { scheduleOmniRotationMonitor } from '@api/jobs/omniRotationMonitor.js';

declare module 'fastify' {
  interface FastifyInstance {
    omniSecrets?: ReturnType<typeof createOmniSecretService>;
  }
}

export const omniSecretsPlugin: FastifyPluginAsync = async (app) => {
  const forceInMemoryDb = process.env.APEX_FORCE_IN_MEMORY_DB === 'true';
  const useInMemoryRepo = (env.database.allowInMemory && !env.database.url) || forceInMemoryDb;

  const repository = useInMemoryRepo
    ? createInMemoryOmniSecretRepository()
    : createOmniSecretRepository(await getSharedDatabasePool(buildDatabasePoolOptions()));

  if (!useInMemoryRepo) {
    await runMigrations(buildDatabasePoolOptions(), app.log);
  }

  const gsmClient = new GsmSecretManagerClient({
    logger: app.log,
    client: useInMemoryRepo
      ? ({
          accessSecretVersion: async ({ name }: { name: string }): Promise<AccessSecretVersionResult> => {
            const simulateFailure =
              process.env.NODE_ENV === 'test' && process.env.APEX_SIMULATE_GSM_FAILURE === 'true';
            if (simulateFailure) {
              throw new Error('simulated gsm failure');
            }
            const payload = Buffer.from(`${name}:mock-secret`, 'utf8');
            const mockResponse: AccessSecretVersionResult = [
              {
                payload: { data: payload },
                name: `${name}/versions/mock`,
              },
              undefined,
              undefined,
            ];
            return mockResponse;
          },
        } satisfies Pick<SecretManagerServiceClient, 'accessSecretVersion'> & {
          accessSecretVersion: ({ name }: { name: string }) => Promise<AccessSecretVersionResult>;
        })
      : undefined,
  });
  const cache = new OmniSecretCache({
    ttlMs: env.omniSecrets.cacheTtlSeconds * 1000,
    gsmClient,
    logger: app.log,
  });
  const telemetry = createOmniSecretsTelemetry(app.metricsRegistry);
  const alerts = createOmniSecretsAlerts(app.log);

  const service = createOmniSecretService({
    repository,
    cache,
    gsmClient,
    logger: app.log,
    telemetry,
    alerts,
  });

  app.decorate('omniSecrets', service);

  await app.register(omniStatusRoute, { service });
  await app.register(omniRotationPreviewRoute, { service });
  await app.register(omniCacheRefreshRoute, { service });
  await app.register(omniBreakGlassRoute, { service });

  const monitorHandle = scheduleOmniRotationMonitor({
    service,
    logger: {
      warn(message, context) {
        app.log.warn(context, message);
      },
    },
  });

  app.addHook('onClose', (_instance, done) => {
    monitorHandle.stop();
    done();
  });
};

export default omniSecretsPlugin;
