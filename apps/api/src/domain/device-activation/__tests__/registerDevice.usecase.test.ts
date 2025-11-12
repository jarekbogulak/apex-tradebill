import { makeRegisterDevice } from '../registerDevice.usecase.js';
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
        issuedAt: payload.expiresAt,
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
        record.consumedAt = new Date().toISOString();
        record.deviceId = deviceId;
        codes.set(codeId, record);
      }
    },
    async getRegistration(deviceId) {
      return registrations.get(deviceId) ?? null;
    },
    async createUser(userId) {
      users.add(userId);
    },
    async upsertRegistration(deviceId, userId) {
      registrations.set(deviceId, {
        deviceId,
        userId,
        lastSeenAt: new Date().toISOString(),
      });
    },
    async updateRegistrationLastSeen(deviceId) {
      const record = registrations.get(deviceId);
      if (record) {
        record.lastSeenAt = new Date().toISOString();
        registrations.set(deviceId, record);
      }
    },
  };

  return { repository, codes, registrations, users };
};

const createTokenFactory = (): TokenFactory => {
  return {
    createToken({ userId, deviceId, expiresAtSeconds }) {
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
    const code: ActivationCodeRecord = {
      id: 'code-1',
      deviceId: 'device-alpha',
      expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      signature: 'signature',
      consumedAt: null,
    };
    const activation = createActivationVerifier({ payload: code });
    const { repository, registrations, users } = createInMemoryRepository([code]);
    const registerDevice = makeRegisterDevice({
      repository,
      activation,
      tokenFactory: createTokenFactory(),
      now: () => now,
      generateUserId: () => 'user-123',
    });

    const result = await registerDevice({ deviceId: 'device-alpha', activationCode: 'ATC1.valid' });

    expect(result.userId).toBe('user-123');
    expect(result.deviceId).toBe('device-alpha');
    expect(result.token).toContain('user-123');
    expect(registrations.get('device-alpha')?.userId).toBe('user-123');
    expect(users.has('user-123')).toBe(true);
  });

  it('rejects expired codes', async () => {
    const expired: ActivationCodeRecord = {
      id: 'code-expired',
      deviceId: 'device-beta',
      expiresAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      signature: 'sig',
      consumedAt: null,
    };
    const activation = createActivationVerifier({ payload: expired });
    const { repository } = createInMemoryRepository([expired]);
    const registerDevice = makeRegisterDevice({
      repository,
      activation,
      tokenFactory: createTokenFactory(),
      now: () => now,
      generateUserId: () => 'user-abc',
    });

    await expect(
      registerDevice({ deviceId: 'device-beta', activationCode: 'ATC1.xxx' }),
    ).rejects.toThrow('Activation code has expired');
  });
});
