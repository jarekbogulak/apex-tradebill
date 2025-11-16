import { jest } from '@jest/globals';
import { GsmSecretManagerClient } from '../../src/modules/omniSecrets/gsmClient.js';

const accessSecretVersionMock = jest.fn();

jest.mock('@google-cloud/secret-manager', () => {
  return {
    SecretManagerServiceClient: jest.fn(() => ({
      accessSecretVersion: accessSecretVersionMock,
    })),
  };
});

describe('GsmSecretManagerClient', () => {
  beforeEach(() => {
    accessSecretVersionMock.mockReset();
  });

  it('fetches secret values and returns version metadata', async () => {
    accessSecretVersionMock.mockResolvedValue([
      {
        payload: { data: Buffer.from('super-secret') },
        name: 'projects/demo/secrets/foo/versions/7',
      },
    ]);
    const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const client = new GsmSecretManagerClient({ logger });

    const result = await client.accessSecretVersion('projects/demo/secrets/foo', '7');

    expect(accessSecretVersionMock).toHaveBeenCalledWith({
      name: 'projects/demo/secrets/foo/versions/7',
    });
    expect(result.value).toBe('super-secret');
    expect(result.version).toBe('7');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs warning when GSM call fails and rethrows error', async () => {
    const error = new Error('boom');
    accessSecretVersionMock.mockRejectedValue(error);
    const logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn() };
    const client = new GsmSecretManagerClient({ logger });

    await expect(client.accessSecretVersion('projects/demo/secrets/foo', 'latest')).rejects.toThrow(
      'boom',
    );
    expect(logger.warn).toHaveBeenCalledWith('gsm.secret_access_failed', {
      err: error,
      secretResource: 'projects/demo/secrets/foo',
      version: 'latest',
    });
  });
});
