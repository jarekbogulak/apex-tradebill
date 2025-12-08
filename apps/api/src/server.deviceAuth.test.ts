/**
 * Verifies device activation secret bootstrap behavior in server startup.
 *
 * We inject lightweight stubs to avoid DB/network access:
 * - Market data, trade calculations, and job scheduler are stubbed.
 * - Omni Secrets plugin is stubbed to supply (or fail to supply) the client secret.
 * - Device auth service factory is stubbed to capture the activation secret passed in.
 */
import type { FastifyInstance as _FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { DatabasePool } from '@api/adapters/persistence/providers/postgres/pool.js';
import { buildServer, type BuildServerOverrides } from '@api/server.js';
import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import type {
  CreateMarketInfrastructureOptions,
  MarketInfrastructure,
} from '@api/adapters/streaming/marketData/infrastructure.js';
import type {
  ResolveTradeCalculationRepositoryOptions,
  ResolvedTradeCalculationRepository,
} from '@api/adapters/persistence/trade-calculations/resolveTradeCalculationRepository.js';
import type { CreateJobSchedulerOptions, JobScheduler } from '@api/adapters/jobs/scheduler.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret-1234567890';
process.env.APEX_FORCE_IN_MEMORY_DB = 'true';
delete process.env.APEX_OMNI_API_SECRET;
delete process.env.APEX_OMNI_API_KEY;
delete process.env.APEX_OMNI_API_PASSPHRASE;

const registerDeviceMock = jest.fn();
let lastActivationSecret: string | null = null;
const createDeviceAuthServiceStub: NonNullable<BuildServerOverrides['createDeviceAuthService']> = ({
  activationSecret,
}) => {
  lastActivationSecret = activationSecret;
  return { registerDevice: registerDeviceMock };
};

const omniSecretValue = {
  secretType: 'trading_client_secret',
  value: 'secret-from-omni',
  version: 'v1',
  source: 'test',
};
const getSecretValueMock = jest.fn();
const omniSecretsPluginCallMock = jest.fn();
const omniSecretsStub: OmniSecretService = {
  getSecretValue: getSecretValueMock as unknown as OmniSecretService['getSecretValue'],
  getStatus: jest.fn(),
  rotationPreview: jest.fn(),
  refreshCache: jest.fn(),
  applyBreakGlass: jest.fn(),
  listMetadata: jest.fn(),
  isSecretAvailable: jest.fn(),
};
const omniSecretsPluginStub: FastifyPluginAsync = fp(async (app) => {
  omniSecretsPluginCallMock();
  // Cast because Fastify's typings expect GetterSetter; we only need the value for tests.
  (app.decorate as unknown as (name: string, value: unknown) => void)('omniSecrets', omniSecretsStub);
});

const createMarketInfrastructureStub = jest.fn<
  Promise<MarketInfrastructure>,
  [CreateMarketInfrastructureOptions]
>(async (): Promise<MarketInfrastructure> => ({
  marketData: {
    getLatestSnapshot: jest.fn().mockResolvedValue(null),
    getRecentCandles: jest.fn().mockResolvedValue([]),
  },
  ringBuffer: undefined,
  streaming: undefined,
}));

const resolveTradeCalculationRepositoryStub = jest.fn<
  Promise<ResolvedTradeCalculationRepository>,
  [ResolveTradeCalculationRepositoryOptions]
>(async (): Promise<ResolvedTradeCalculationRepository> => ({
  repository: {
    findById: jest.fn(),
    save: jest.fn(),
    listRecent: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    deleteOlderThan: jest.fn().mockResolvedValue(0),
  },
  pool: {} as unknown as DatabasePool,
}));

const createJobSchedulerStub = jest.fn<JobScheduler, [CreateJobSchedulerOptions]>(() => ({
  scheduleTradeHistoryPrune: jest.fn(async () => ({
    cancel: jest.fn(),
  })),
}));

const buildOverrides = (): BuildServerOverrides => ({
  createDeviceAuthService: createDeviceAuthServiceStub,
  createMarketInfrastructure: createMarketInfrastructureStub,
  resolveTradeCalculationRepository: resolveTradeCalculationRepositoryStub,
  createJobScheduler: createJobSchedulerStub,
  omniSecretsPlugin: omniSecretsPluginStub,
});

describe('device activation secret bootstrap', () => {
  beforeEach(() => {
    registerDeviceMock.mockReset();
    getSecretValueMock.mockReset();
    omniSecretsPluginCallMock.mockReset();
    lastActivationSecret = null;
    createMarketInfrastructureStub.mockClear();
    resolveTradeCalculationRepositoryStub.mockClear();
    createJobSchedulerStub.mockClear();

    resolveTradeCalculationRepositoryStub.mockResolvedValue({
      repository: {
        findById: jest.fn(),
        save: jest.fn(),
        listRecent: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
        deleteOlderThan: jest.fn().mockResolvedValue(0),
      },
      pool: {} as unknown as DatabasePool,
    });

    createMarketInfrastructureStub.mockResolvedValue({
      marketData: {
        getLatestSnapshot: jest.fn().mockResolvedValue(null),
        getRecentCandles: jest.fn().mockResolvedValue([]),
      },
      ringBuffer: undefined,
      streaming: undefined,
    });

    createJobSchedulerStub.mockReturnValue({
      scheduleTradeHistoryPrune: jest.fn(async () => ({
        cancel: jest.fn(),
      })),
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('pulls activation secret from Omni Secrets when env var is missing', async () => {
    getSecretValueMock.mockResolvedValue(omniSecretValue);
    const app = await buildServer(buildOverrides());

    await app.ready();
    expect(omniSecretsPluginCallMock).toHaveBeenCalled();
    expect(app.hasDecorator('omniSecrets')).toBe(true);
    expect(app.omniSecrets).toBeDefined();
    expect(createMarketInfrastructureStub).toHaveBeenCalled();
    expect(resolveTradeCalculationRepositoryStub).toHaveBeenCalled();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: 'device-123',
        activationCode: 'ATC1.mock',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(lastActivationSecret).toBe('secret-from-omni');
    expect(registerDeviceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'device-123',
        activationCode: 'ATC1.mock',
      }),
    );
    expect(getSecretValueMock).toHaveBeenCalledWith('trading_client_secret');

    await app.close();
  });

  it('returns 503 when Omni Secrets fails to supply the client secret', async () => {
    getSecretValueMock.mockRejectedValue(new Error('gsm unavailable'));
    const app = await buildServer(buildOverrides());

    await app.ready();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: 'device-abc',
        activationCode: 'ATC1.fail',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(registerDeviceMock).not.toHaveBeenCalled();
    expect(lastActivationSecret).toBeNull();

    await app.close();
  });
});
