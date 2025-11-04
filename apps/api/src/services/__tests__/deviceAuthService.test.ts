import crypto from 'node:crypto';
import { createDeviceAuthService } from '../deviceAuthService.js';
import type {
  DatabasePool,
  DatabaseClient,
  QueryResult,
  QueryResultRow,
} from '../../infra/database/pool.js';

interface ActivationRow {
  id: string;
  deviceId: string;
  expiresAt: string;
  signature: string;
  consumedAt: string | null;
}

interface RegistrationRow {
  deviceId: string;
  userId: string;
  registeredAt: string;
  lastSeenAt: string;
}

interface AppUserRow {
  id: string;
  createdAt: string;
  lastSeenAt: string;
}

const createActivationCode = ({
  deviceId,
  codeId,
  issuedAt,
  expiresAt,
  secret,
}: {
  deviceId: string;
  codeId: string;
  issuedAt: string;
  expiresAt: string;
  secret: string;
}) => {
  const data = `1.${deviceId}.${issuedAt}.${expiresAt}.${codeId}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const payload = {
    v: 1,
    codeId,
    deviceId,
    issuedAt,
    expiresAt,
    sig: signature,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    activationCode: `ATC1.${encoded}`,
    signature,
  };
};

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

const createFakePool = () => {
  const activationCodes = new Map<string, ActivationRow>();
  const registrations = new Map<string, RegistrationRow>();
  const users = new Map<string, AppUserRow>();

  class FakeClient implements DatabaseClient {
    inTransaction = false;
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      const normalized = normalizeSql(sql);

      if (normalized === 'begin') {
        this.inTransaction = true;
        return { rows: [] as T[], rowCount: 0 };
      }
      if (normalized === 'commit' || normalized === 'rollback') {
        this.inTransaction = false;
        return { rows: [] as T[], rowCount: 0 };
      }

      if (
        normalized.startsWith(
          'select device_id, expires_at, signature, consumed_at from device_activation_codes',
        )
      ) {
        const id = params[0] as string;
        const row = activationCodes.get(id);
        const rows = row
          ? [
              {
                device_id: row.deviceId,
                expires_at: row.expiresAt,
                signature: row.signature,
                consumed_at: row.consumedAt,
              },
            ]
          : [];
        return {
          rows: rows as unknown as T[],
          rowCount: rows.length,
        };
      }

      if (normalized.startsWith('select user_id from device_registrations')) {
        const deviceId = params[0] as string;
        const row = registrations.get(deviceId);
        const rows = row
          ? [
              {
                user_id: row.userId,
              },
            ]
          : [];
        return {
          rows: rows as unknown as T[],
          rowCount: rows.length,
        };
      }

      if (normalized.startsWith('insert into app_users')) {
        const id = params[0] as string;
        if (!users.has(id)) {
          const now = new Date().toISOString();
          users.set(id, {
            id,
            createdAt: now,
            lastSeenAt: now,
          });
        }
        return { rows: [] as T[], rowCount: 1 };
      }

      if (normalized.startsWith('insert into device_registrations')) {
        const deviceId = params[0] as string;
        const userId = params[1] as string;
        const now = new Date().toISOString();
        registrations.set(deviceId, {
          deviceId,
          userId,
          registeredAt: now,
          lastSeenAt: now,
        });
        return { rows: [] as T[], rowCount: 1 };
      }

      if (normalized.startsWith('update device_registrations set last_seen_at')) {
        const deviceId = params[0] as string;
        const row = registrations.get(deviceId);
        if (row) {
          row.lastSeenAt = new Date().toISOString();
          registrations.set(deviceId, row);
        }
        return { rows: [] as T[], rowCount: row ? 1 : 0 };
      }

      if (normalized.startsWith('update device_activation_codes set consumed_at')) {
        const id = params[0] as string;
        const deviceId = params[1] as string;
        const row = activationCodes.get(id);
        if (row) {
          row.consumedAt = new Date().toISOString();
          row.deviceId = deviceId;
          activationCodes.set(id, row);
        }
        return { rows: [] as T[], rowCount: row ? 1 : 0 };
      }

      throw new Error(`Unhandled SQL in fake client: ${sql}`);
    }

    release(): void {
      this.inTransaction = false;
    }
  }

  const pool: DatabasePool = {
    async connect(): Promise<DatabaseClient> {
      return new FakeClient();
    },
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = [],
    ): Promise<QueryResult<T>> {
      const client = new FakeClient();
      try {
        return await client.query<T>(sql, params);
      } finally {
        client.release();
      }
    },
    async end() {},
    on() {},
  };

  return {
    pool,
    activationCodes,
    registrations,
    users,
  };
};

describe('createDeviceAuthService', () => {
  const activationSecret = 'activation-secret';
  const jwtSecret = 'jwt-secret';
  const now = new Date('2025-11-04T08:27:38.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('registers a new device and returns a signed JWT', async () => {
    const { pool, activationCodes, registrations, users } = createFakePool();
    const codeId = 'code-1';
    const deviceId = 'device-alpha';
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const { activationCode, signature } = createActivationCode({
      deviceId,
      codeId,
      issuedAt,
      expiresAt,
      secret: activationSecret,
    });

    activationCodes.set(codeId, {
      id: codeId,
      deviceId,
      expiresAt,
      signature,
      consumedAt: null,
    });

    const generatedUserId = '123e4567-e89b-12d3-a456-426614174000';
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(generatedUserId);

    const service = createDeviceAuthService({
      pool,
      activationSecret,
      jwtSecret,
    });

    const result = await service.registerDevice({
      deviceId,
      activationCode,
    });

    expect(result.userId).toBe(generatedUserId);
    expect(result.deviceId).toBe(deviceId);
    expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(new Date(result.tokenExpiresAt).getTime()).toBeGreaterThan(now.getTime());

    const payload = JSON.parse(
      Buffer.from(result.token.split('.')[1], 'base64url').toString('utf8'),
    );
    expect(payload.sub).toBe(generatedUserId);
    expect(payload.deviceId).toBe(deviceId);

    const storedActivation = activationCodes.get(codeId);
    expect(storedActivation?.consumedAt).not.toBeNull();

    const registration = registrations.get(deviceId);
    expect(registration?.userId).toBe(generatedUserId);
    expect(users.has(generatedUserId)).toBe(true);
  });

  it('throws when activation code is expired', async () => {
    const { pool, activationCodes } = createFakePool();
    const codeId = 'code-expired';
    const deviceId = 'device-beta';
    const issuedAt = new Date(now.getTime() - 20 * 60_000).toISOString();
    const expiresAt = new Date(now.getTime() - 5 * 60_000).toISOString();
    const { activationCode, signature } = createActivationCode({
      deviceId,
      codeId,
      issuedAt,
      expiresAt,
      secret: activationSecret,
    });

    activationCodes.set(codeId, {
      id: codeId,
      deviceId,
      expiresAt,
      signature,
      consumedAt: null,
    });

    const service = createDeviceAuthService({
      pool,
      activationSecret,
      jwtSecret,
    });

    await expect(
      service.registerDevice({
        deviceId,
        activationCode,
      }),
    ).rejects.toThrow('Activation code has expired');
  });

  it('throws when activation code was already used', async () => {
    const { pool, activationCodes } = createFakePool();
    const codeId = 'code-used';
    const deviceId = 'device-gamma';
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const { activationCode, signature } = createActivationCode({
      deviceId,
      codeId,
      issuedAt,
      expiresAt,
      secret: activationSecret,
    });

    activationCodes.set(codeId, {
      id: codeId,
      deviceId,
      expiresAt,
      signature,
      consumedAt: now.toISOString(),
    });

    const service = createDeviceAuthService({
      pool,
      activationSecret,
      jwtSecret,
    });

    await expect(
      service.registerDevice({
        deviceId,
        activationCode,
      }),
    ).rejects.toThrow('Activation code has already been used');
  });

  it('throws when activation code device differs', async () => {
    const { pool, activationCodes } = createFakePool();
    const codeId = 'code-mismatch';
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const { activationCode, signature } = createActivationCode({
      deviceId: 'expected-device',
      codeId,
      issuedAt,
      expiresAt,
      secret: activationSecret,
    });

    activationCodes.set(codeId, {
      id: codeId,
      deviceId: 'expected-device',
      expiresAt,
      signature,
      consumedAt: null,
    });

    const service = createDeviceAuthService({
      pool,
      activationSecret,
      jwtSecret,
    });

    await expect(
      service.registerDevice({
        deviceId: 'another-device',
        activationCode,
      }),
    ).rejects.toThrow('Activation code does not match device identifier');
  });
});
