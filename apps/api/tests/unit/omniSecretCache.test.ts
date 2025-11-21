import { jest } from '@jest/globals';
import { OmniSecretCache } from '../../src/modules/omniSecrets/cache.js';
import type { OmniSecretMetadata } from '../../src/modules/omniSecrets/types.js';

const buildMetadata = (secretType: string): OmniSecretMetadata => ({
  secretType,
  environment: 'production',
  gcpSecretId: `projects/demo/secrets/${secretType}`,
  gcpVersionAlias: 'latest',
  status: 'active',
  rotationDueAt: new Date(Date.now() + 86_400_000).toISOString(),
});

type FakeGsmClient = {
  accessSecretVersion: jest.Mock<
    Promise<{ value: string; version: string; durationMs: number }>,
    [string, string?]
  >;
};

const createMockGsmClient = (): FakeGsmClient => {
  return {
    accessSecretVersion: jest.fn(async (secretResource: string, version = 'latest') => {
      return {
        value: `${secretResource}-value`,
        version,
        durationMs: 1,
      };
    }),
  };
};

describe('OmniSecretCache', () => {
  it('caches GSM results until TTL expires', async () => {
    const gsmClient = createMockGsmClient();
    const cache = new OmniSecretCache({
      ttlMs: 1_000,
      gsmClient,
      logger: { info: jest.fn(), warn: jest.fn() },
    });
    const metadata = buildMetadata('trading_api_key');

    const entry = await cache.getOrFetch(metadata);
    expect(entry.value).toContain(metadata.gcpSecretId);
    expect(gsmClient.accessSecretVersion).toHaveBeenCalledTimes(1);

    const cachedAgain = await cache.getOrFetch(metadata);
    expect(cachedAgain).toBe(entry);
    expect(gsmClient.accessSecretVersion).toHaveBeenCalledTimes(1);
  });

  it('prefers break-glass values and clears them when requested', () => {
    const cache = new OmniSecretCache({
      ttlMs: 1_000,
      gsmClient: {
        accessSecretVersion: jest.fn(async () => []),
      } as FakeGsmClient,
      logger: { info: jest.fn(), warn: jest.fn() },
    });

    cache.setBreakGlass('webhook_shared_secret', 'encrypted-payload', 600_000);
    const breakGlassEntry = cache.getCached('webhook_shared_secret');
    expect(breakGlassEntry?.source).toBe('break_glass');
    expect(breakGlassEntry?.value).toBe('encrypted-payload');

    cache.clearBreakGlass('webhook_shared_secret');
    const cleared = cache.getCached('webhook_shared_secret');
    expect(cleared).toBeNull();
  });
});
