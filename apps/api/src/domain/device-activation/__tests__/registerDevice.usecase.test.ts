import { makeRegisterDevice } from '../registerDevice.usecase.js';
import {
  createDeviceActivationCode,
  markDeviceActivationCodeConsumed,
} from '../../device-activation-code/device-activation-code.entity.js';
import {
  createDeviceRegistration,
  touchDeviceRegistration,
} from '../../device-registration/device-registration.entity.js';
import type {
  ActivationCodeVerifier,
  ActivationCodeRecord,
  DeviceActivationRepository,
  DeviceRegistrationRecord,
  TokenFactory,
} from '../types.js';

const createActivationVerifier = ({
  payload,
  shouldError = false,
}: {
  payload: ActivationCodeRecord;
  shouldError?: boolean;
}): ActivationCodeVerifier => {
  return {
    decode(code: string) {
      if (!code.startsWith('ATC1.')) {
        throw new Error('Invalid activation code format');
      }
      return {
        version: 1,
        codeId: payload.id,
        deviceId: payload.deviceId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        signature: payload.signature,
      };
    },
    verifySignature() {
      if (shouldError) {
        throw new Error('Activation code signature mismatch');
      }
    },
  };
};

const createInMemoryRepository = (seedCodes: ActivationCodeRecord[] = []) => {
  const codes = new Map<string, ActivationCodeRecord>(seedCodes.map((entry) => [entry.id, entry]));
  const registrations = new Map<string, DeviceRegistrationRecord>();
  const users = new Set<string>();

  const repository: DeviceActivationRepository = {
    async getCodeById(codeId) {
      return codes.get(codeId) ?? null;
    },
    async markCodeConsumed(codeId, deviceId) {
      const record = codes.get(codeId);
      if (record) {
        const updated = markDeviceActivationCodeConsumed(record, deviceId, new Date().toISOString());
        codes.set(codeId, updated);
      }
    },
    async getRegistration(deviceId) {
      return registrations.get(deviceId) ?? null;
    },
    async createUser(userId) {
      users.add(userId);
    },
    async upsertRegistration(deviceId, userId) {
      const existing = registrations.get(deviceId);
      const nowIso = new Date().toISOString();
      if (existing) {
        registrations.set(deviceId, {
          ...existing,
          userId,
          lastSeenAt: nowIso,
        });
        return;
      }
      registrations.set(
        deviceId,
        createDeviceRegistration({
          deviceId,
          userId,
          registeredAt: nowIso,
          lastSeenAt: nowIso,
        }),
      );
    },
    async updateRegistrationLastSeen(deviceId) {
      const record = registrations.get(deviceId);
      if (record) {
        registrations.set(deviceId, touchDeviceRegistration(record));
      }
    },
  };

  return { repository, codes, registrations, users };
};

const createTokenFactory = (): TokenFactory => {
  return {
    createToken({ userId, deviceId, issuedAtSeconds: _issuedAt, expiresAtSeconds }) {
      return {
        token: `${userId}.${deviceId}.${expiresAtSeconds}`,
        expiresAtIso: new Date(expiresAtSeconds * 1000).toISOString(),
      };
    },
  };
};

describe('registerDevice.usecase', () => {
  const now = new Date('2025-11-04T08:27:38.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers new devices and emits tokens', async () => {
    const code: ActivationCodeRecord = createDeviceActivationCode({
      id: '11111111-1111-1111-1111-111111111111',
      deviceId: 'device-alpha',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      signature: 'signature',
      createdAt: now.toISOString(),
      consumedAt: null,
      consumedByDevice: null,
    });
    const activation = createActivationVerifier({ payload: code });
    const { repository, registrations, users } = createInMemoryRepository([code]);
    const registerDevice = makeRegisterDevice({
      repository,
      activation,
      tokenFactory: createTokenFactory(),
      now: () => now,
      generateUserId: () => '00000000-0000-0000-0000-000000000123',
    });

    const result = await registerDevice({ deviceId: 'device-alpha', activationCode: 'ATC1.valid' });

    expect(result.userId).toBe('00000000-0000-0000-0000-000000000123');
    expect(result.deviceId).toBe('device-alpha');
    expect(result.token).toContain('00000000-0000-0000-0000-000000000123');
    expect(registrations.get('device-alpha')?.userId).toBe('00000000-0000-0000-0000-000000000123');
    expect(users.has('00000000-0000-0000-0000-000000000123')).toBe(true);
  });

  it('rejects expired codes', async () => {
    const expired: ActivationCodeRecord = createDeviceActivationCode({
      id: '22222222-2222-2222-2222-222222222222',
      deviceId: 'device-beta',
      issuedAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
      expiresAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      signature: 'sig',
      createdAt: now.toISOString(),
      consumedAt: null,
      consumedByDevice: null,
    });
    const activation = createActivationVerifier({ payload: expired });
    const { repository } = createInMemoryRepository([expired]);
    const registerDevice = makeRegisterDevice({
      repository,
      activation,
      tokenFactory: createTokenFactory(),
      now: () => now,
      generateUserId: () => '00000000-0000-0000-0000-000000000abc',
    });

    await expect(
      registerDevice({ deviceId: 'device-beta', activationCode: 'ATC1.xxx' }),
    ).rejects.toThrow('Activation code has expired');
  });
});
