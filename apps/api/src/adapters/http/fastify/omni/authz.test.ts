import Fastify from 'fastify';
import crypto from 'node:crypto';
import authenticationPlugin from '@api/plugins/authentication.js';
import omniStatusRoute from './status.js';

const tokenSecret = 'ops-test-secret-123456';

const createToken = (claims: Record<string, unknown>): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'ops-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', tokenSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
};

describe('omni ops route authorization', () => {
  const service = {
    getStatus: jest.fn().mockResolvedValue({ data: [], updatedAt: '2024-01-01T00:00:00.000Z' }),
    rotationPreview: jest.fn(),
    refreshCache: jest.fn(),
    applyBreakGlass: jest.fn(),
    isSecretAvailable: jest.fn(),
    getSecretValue: jest.fn(),
    listMetadata: jest.fn(),
  };

  const buildApp = async () => {
    const app = Fastify();
    await app.register(authenticationPlugin, { secret: tokenSecret, allowGuest: false });
    await app.register(omniStatusRoute, { service });
    return app;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no authorization header is provided', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/ops/apex-omni/secrets/status',
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 403 when token lacks required scope/role', async () => {
    const app = await buildApp();
    const token = createToken({});
    const response = await app.inject({
      method: 'GET',
      url: '/ops/apex-omni/secrets/status',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(403);
    expect(service.getStatus).not.toHaveBeenCalled();
    await app.close();
  });

  it('allows access when token has omni:manage scope', async () => {
    const app = await buildApp();
    const token = createToken({ scope: 'omni:manage profile:read' });
    const response = await app.inject({
      method: 'GET',
      url: '/ops/apex-omni/secrets/status',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(service.getStatus).toHaveBeenCalled();
    await app.close();
  });
});
