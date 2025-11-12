import Fastify from 'fastify';
import postDeviceRegisterRoute, {
  type DeviceAuthServiceRef,
} from '../postDeviceRegister.js';
import type { DeviceAuthService } from '../../../../security/deviceAuthService.js';

describe('postDeviceRegisterRoute', () => {
  const toRef = (value: Partial<DeviceAuthService> | null): DeviceAuthServiceRef => ({
    current: value as DeviceAuthService | null,
  });

  it('returns 200 with device registration result', async () => {
    const app = Fastify();
    const registerDevice = jest.fn().mockResolvedValue({
      userId: '11111111-2222-3333-4444-555555555555',
      deviceId: 'device-123',
      token: 'jwt-token',
      tokenExpiresAt: '2025-11-05T00:00:00.000Z',
    });

    await app.register(postDeviceRegisterRoute, {
      deviceAuthServiceRef: toRef({ registerDevice }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: 'device-123',
        activationCode: 'ATC1.mock',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      userId: '11111111-2222-3333-4444-555555555555',
      deviceId: 'device-123',
      token: 'jwt-token',
      tokenExpiresAt: '2025-11-05T00:00:00.000Z',
    });
    expect(registerDevice).toHaveBeenCalledWith({
      deviceId: 'device-123',
      activationCode: 'ATC1.mock',
      ipAddress: expect.any(String),
    });
  });

  it('returns 503 when device auth service unavailable', async () => {
    const app = Fastify();
    await app.register(postDeviceRegisterRoute, { deviceAuthServiceRef: toRef(null) });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: 'device-123',
        activationCode: 'ATC1.mock',
      },
    });

    expect(response.statusCode).toBe(503);
  });

  it('returns 400 on validation error', async () => {
    const app = Fastify();
    await app.register(postDeviceRegisterRoute, {
      deviceAuthServiceRef: toRef({ registerDevice: jest.fn() }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: '',
        activationCode: '',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('maps service errors to status codes', async () => {
    const app = Fastify();
    const registerDevice = jest
      .fn()
      .mockRejectedValue(new Error('Activation code has already been used'));

    await app.register(postDeviceRegisterRoute, {
      deviceAuthServiceRef: toRef({ registerDevice }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/device/register',
      payload: {
        deviceId: 'device-123',
        activationCode: 'ATC1.mock',
      },
    });

    expect(response.statusCode).toBe(409);
  });
});
