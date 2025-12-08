import crypto from 'node:crypto';
import fastify from 'fastify';
import { DEFAULT_USER_ID } from '../../adapters/http/fastify/shared/http.js';
import { authenticationPlugin } from '../authentication.js';

const toBase64Url = (value: Buffer) => {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const createToken = (claims: Record<string, unknown>, secret: string) => {
  const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = toBase64Url(Buffer.from(JSON.stringify(claims)));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
};

const buildApp = async (
  options: Parameters<typeof authenticationPlugin>[1] = {
    secret: 'secret',
    issuer: 'apex',
    audience: 'mobile',
  },
) => {
  const app = fastify({ logger: false });
  await authenticationPlugin(app, options);
  app.get('/whoami', async (request) => {
    return {
      userId: request.auth?.userId,
      token: request.auth?.token,
    };
  });
  return app;
};

describe('authenticationPlugin', () => {
  it('allows guest access when no authorization header is present', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/whoami' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: DEFAULT_USER_ID,
      token: 'guest',
    });

    await app.close();
  });

  it('authenticates valid JWT tokens with issuer and audience checks', async () => {
    const secret = 'top-secret';
    const token = createToken(
      {
        sub: 'user-123',
        iss: 'apex',
        aud: 'mobile',
        exp: Math.floor(Date.now() / 1000) + 60,
        deviceId: 'device-1',
      },
      secret,
    );

    const app = await buildApp({
      secret,
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        authorization: `Bearer ${token}`,
        'x-device-id': 'device-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: 'user-123',
      token,
    });

    await app.close();
  });

  it('rejects tokens with invalid signatures', async () => {
    const token = createToken(
      {
        sub: 'user-123',
        iss: 'apex',
        aud: 'mobile',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      'secret-one',
    );

    const app = await buildApp({
      secret: 'secret-two',
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'JWT signature mismatch',
    });

    await app.close();
  });

  it('rejects mismatched device identifiers when provided', async () => {
    const secret = 'device-secret';
    const token = createToken(
      {
        sub: 'user-123',
        iss: 'apex',
        aud: 'mobile',
        exp: Math.floor(Date.now() / 1000) + 60,
        deviceId: 'device-1',
      },
      secret,
    );

    const app = await buildApp({
      secret,
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: {
        authorization: `Bearer ${token}`,
        'x-device-id': 'device-2',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Device identifier mismatch',
    });

    await app.close();
  });

  it('denies guest access when disabled', async () => {
    const app = await buildApp({
      secret: 'secret',
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
    });

    const response = await app.inject({ method: 'GET', url: '/whoami' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authorization header missing',
    });

    await app.close();
  });

  it('bypasses authentication for whitelisted paths even when guests are disabled', async () => {
    const app = fastify({ logger: false });
    await authenticationPlugin(app, {
      secret: 'secret',
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
      unauthenticatedPaths: ['/v1/auth/device/register'],
    });
    app.post('/v1/auth/device/register', async (request) => {
      return {
        userId: request.auth?.userId,
        token: request.auth?.token,
        claims: request.auth?.claims,
      };
    });

    const response = await app.inject({ method: 'POST', url: '/v1/auth/device/register' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: DEFAULT_USER_ID,
      token: 'guest',
      claims: {},
    });

    await app.close();
  });

  it('still enforces authentication for non-whitelisted paths', async () => {
    const app = fastify({ logger: false });
    await authenticationPlugin(app, {
      secret: 'secret',
      issuer: 'apex',
      audience: 'mobile',
      allowGuest: false,
      unauthenticatedPaths: ['/v1/auth/device/register'],
    });
    app.get('/protected', async (request) => {
      return {
        userId: request.auth?.userId,
        token: request.auth?.token,
      };
    });

    const response = await app.inject({ method: 'GET', url: '/protected' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Authorization header missing',
    });

    await app.close();
  });
});
