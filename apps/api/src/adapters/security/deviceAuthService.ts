import crypto, { randomUUID } from 'node:crypto';
import type {
  DatabaseClient,
  DatabasePool,
  QueryResultRow,
} from '../persistence/providers/postgres/pool.js';
import { makeRegisterDevice } from '../../domain/device-activation/registerDevice.usecase.js';
import type {
  ActivationCodeRecord,
  ActivationCodeVerifier,
  ActivationPayload,
  DeviceActivationRepository,
  DeviceRegistrationRecord,
  RegisterDeviceInput,
  RegisterDeviceResult,
  TokenFactory,
  TokenPayload,
} from '../../domain/device-activation/types.js';

const ACTIVATION_PREFIX = 'ATC1.';

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad > 0 ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64').toString('utf8');
};

interface RawActivationPayload {
  v: number;
  codeId: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  sig: string;
}

const parseActivationPayload = (code: string): RawActivationPayload => {
  if (!code || !code.startsWith(ACTIVATION_PREFIX)) {
    throw new Error('Invalid activation code format');
  }
  const encoded = code.slice(ACTIVATION_PREFIX.length);

  let payload: RawActivationPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as RawActivationPayload;
  } catch {
    throw new Error('Activation code payload could not be decoded');
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    payload.v !== 1 ||
    typeof payload.deviceId !== 'string' ||
    typeof payload.codeId !== 'string' ||
    typeof payload.issuedAt !== 'string' ||
    typeof payload.expiresAt !== 'string' ||
    typeof payload.sig !== 'string'
  ) {
    throw new Error('Activation code payload is invalid');
  }

  return payload;
};

const createActivationVerifier = (secret: string): ActivationCodeVerifier => {
  return {
    decode(code: string) {
      const payload = parseActivationPayload(code);
      return {
        version: payload.v,
        codeId: payload.codeId,
        deviceId: payload.deviceId,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        signature: payload.sig,
      };
    },
    verifySignature(payload: ActivationPayload) {
      const data = `1.${payload.deviceId}.${payload.issuedAt}.${payload.expiresAt}.${payload.codeId}`;
      const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(payload.signature))) {
        throw new Error('Activation code signature mismatch');
      }
    },
  };
};

const createJwt = (payload: Record<string, unknown>, secret: string): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const encode = (object: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(object)).toString('base64url');

  const encodedHeader = encode(header);
  const encodedPayload = encode(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

interface JwtFactoryOptions {
  secret: string;
  issuer?: string;
  audience?: string;
}

const createTokenFactory = ({ secret, issuer, audience }: JwtFactoryOptions): TokenFactory => {
  return {
    createToken({ userId, deviceId, issuedAtSeconds, expiresAtSeconds }: TokenPayload) {
      const payload: Record<string, unknown> = {
        sub: userId,
        deviceId,
        iat: issuedAtSeconds,
        exp: expiresAtSeconds,
      };

      if (issuer) {
        payload.iss = issuer;
      }

      if (audience) {
        payload.aud = audience;
      }

      const token = createJwt(payload, secret);
      return {
        token,
        expiresAtIso: new Date(expiresAtSeconds * 1000).toISOString(),
      };
    },
  };
};

const withTransaction = async <T>(pool: DatabasePool, fn: (client: DatabaseClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

interface ActivationCodeRow extends QueryResultRow {
  id: string;
  device_id: string;
  expires_at: string;
  signature: string;
  consumed_at: string | null;
}

interface RegistrationRow extends QueryResultRow {
  device_id: string;
  user_id: string;
  last_seen_at: string;
}

const mapActivationRow = (row: ActivationCodeRow): ActivationCodeRecord => ({
  id: row.id,
  deviceId: row.device_id,
  expiresAt: row.expires_at,
  signature: row.signature,
  consumedAt: row.consumed_at,
});

const mapRegistrationRow = (row: RegistrationRow): DeviceRegistrationRecord => ({
  deviceId: row.device_id,
  userId: row.user_id,
  lastSeenAt: row.last_seen_at,
});

const createPgDeviceActivationRepository = (
  client: DatabaseClient,
): DeviceActivationRepository => ({
  async getCodeById(codeId: string) {
    const { rows } = await client.query<ActivationCodeRow>(
      `
        SELECT id, device_id, expires_at, signature, consumed_at
        FROM device_activation_codes
        WHERE id = $1
        FOR UPDATE;
      `,
      [codeId],
    );
    const row = rows[0];
    return row ? mapActivationRow(row) : null;
  },
  async markCodeConsumed(codeId: string, deviceId: string) {
    await client.query(
      `
        UPDATE device_activation_codes
        SET consumed_at = NOW(),
            consumed_by_device = $2
        WHERE id = $1;
      `,
      [codeId, deviceId],
    );
  },
  async getRegistration(deviceId: string) {
    const { rows } = await client.query<RegistrationRow>(
      `
        SELECT device_id, user_id, last_seen_at
        FROM device_registrations
        WHERE device_id = $1
        FOR UPDATE;
      `,
      [deviceId],
    );
    const row = rows[0];
    return row ? mapRegistrationRow(row) : null;
  },
  async createUser(userId: string) {
    await client.query(
      `
        INSERT INTO app_users (id, created_at, last_seen_at)
        VALUES ($1, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
      `,
      [userId],
    );
  },
  async upsertRegistration(deviceId: string, userId: string) {
    await client.query(
      `
        INSERT INTO device_registrations (device_id, user_id, registered_at, last_seen_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (device_id) DO UPDATE
          SET user_id = EXCLUDED.user_id,
              last_seen_at = NOW();
      `,
      [deviceId, userId],
    );
  },
  async updateRegistrationLastSeen(deviceId: string) {
    await client.query(
      `
        UPDATE device_registrations
        SET last_seen_at = NOW()
        WHERE device_id = $1;
      `,
      [deviceId],
    );
  },
});

export interface DeviceAuthServiceDeps {
  pool: DatabasePool;
  activationSecret: string;
  jwtSecret: string;
  jwtIssuer?: string;
  jwtAudience?: string;
}

export const createDeviceAuthService = ({
  pool,
  activationSecret,
  jwtSecret,
  jwtIssuer,
  jwtAudience,
}: DeviceAuthServiceDeps) => {
  if (!activationSecret) {
    throw new Error('activationSecret is required to register devices');
  }
  const activation = createActivationVerifier(activationSecret);
  const tokenFactory = createTokenFactory({ secret: jwtSecret, issuer: jwtIssuer, audience: jwtAudience });

  const registerDevice = async (input: RegisterDeviceInput): Promise<RegisterDeviceResult> => {
    return withTransaction(pool, async (client) => {
      const repository = createPgDeviceActivationRepository(client);
      const execute = makeRegisterDevice({
        repository,
        activation,
        tokenFactory,
        now: () => new Date(),
        generateUserId: randomUUID,
      });
      return execute(input);
    });
  };

  return {
    registerDevice,
  };
};

export type DeviceAuthService = ReturnType<typeof createDeviceAuthService>;
