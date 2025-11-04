import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { DatabaseClient, DatabasePool } from '../infra/database/pool.js';

const ACTIVATION_PREFIX = 'ATC1.';
const TOKEN_TTL_DAYS = 30;

interface ActivationPayload {
  v: number;
  codeId: string;
  deviceId: string;
  issuedAt: string;
  expiresAt: string;
  sig: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  activationCode: string;
  ipAddress?: string;
}

export interface RegisterDeviceResult {
  userId: string;
  deviceId: string;
  token: string;
  tokenExpiresAt: string;
}

export interface DeviceAuthServiceDeps {
  pool: DatabasePool;
  activationSecret: string;
  jwtSecret: string;
  jwtIssuer?: string;
  jwtAudience?: string;
}

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad > 0 ? '='.repeat(4 - pad) : '');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const parseActivationCode = (code: string): ActivationPayload => {
  if (!code || !code.startsWith(ACTIVATION_PREFIX)) {
    throw new Error('Invalid activation code format');
  }
  const encoded = code.slice(ACTIVATION_PREFIX.length);

  let payload: ActivationPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as ActivationPayload;
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

const verifySignature = (payload: ActivationPayload, secret: string): void => {
  const data = `1.${payload.deviceId}.${payload.issuedAt}.${payload.expiresAt}.${payload.codeId}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(payload.sig))) {
    throw new Error('Activation code signature mismatch');
  }
};

const createJwt = (
  payload: Record<string, unknown>,
  secret: string,
): string => {
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

const withTransaction = async <T>(
  pool: DatabasePool,
  fn: (client: DatabaseClient) => Promise<T>,
): Promise<T> => {
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
  const registerDevice = async ({
    deviceId,
    activationCode,
    ipAddress: _ipAddress,
  }: RegisterDeviceInput): Promise<RegisterDeviceResult> => {
    const payload = parseActivationCode(activationCode);
    verifySignature(payload, activationSecret);

    if (payload.deviceId !== deviceId) {
      throw new Error('Activation code does not match device identifier');
    }

    const expiresAtMs = Date.parse(payload.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
      throw new Error('Activation code has expired');
    }

    return withTransaction(pool, async (client) => {
      const { rows: codeRows } = await client.query<{
        device_id: string;
        expires_at: string;
        signature: string;
        consumed_at: string | null;
      }>(
        `
          SELECT device_id, expires_at, signature, consumed_at
          FROM device_activation_codes
          WHERE id = $1
          FOR UPDATE;
        `,
        [payload.codeId],
      );

      const codeRow = codeRows[0];
      if (!codeRow) {
        throw new Error('Activation code is not recognized');
      }

      if (codeRow.device_id !== deviceId) {
        throw new Error('Activation code was issued for another device');
      }

      if (codeRow.signature !== payload.sig) {
        throw new Error('Activation code signature mismatch');
      }

      if (codeRow.consumed_at != null) {
        throw new Error('Activation code has already been used');
      }

      const dbExpiresAtMs = Date.parse(codeRow.expires_at);
      if (!Number.isFinite(dbExpiresAtMs) || dbExpiresAtMs < Date.now()) {
        throw new Error('Activation code is expired');
      }

      const { rows: registrationRows } = await client.query<{
        user_id: string;
      }>(
        `
          SELECT user_id
          FROM device_registrations
          WHERE device_id = $1
          FOR UPDATE;
        `,
        [deviceId],
      );

      let userId = registrationRows[0]?.user_id;

      if (!userId) {
        userId = randomUUID();
        await client.query(
          `
            INSERT INTO app_users (id, created_at, last_seen_at)
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `,
          [userId],
        );

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
      } else {
        await client.query(
          `
            UPDATE device_registrations
            SET last_seen_at = NOW()
            WHERE device_id = $1;
          `,
          [deviceId],
        );
      }

      await client.query(
        `
          UPDATE device_activation_codes
          SET consumed_at = NOW(),
              consumed_by_device = $2
          WHERE id = $1;
        `,
        [payload.codeId, deviceId],
      );

      const issuedAtSeconds = Math.floor(Date.now() / 1000);
      const expiresAtSeconds = issuedAtSeconds + TOKEN_TTL_DAYS * 24 * 60 * 60;
      const tokenPayload: Record<string, unknown> = {
        sub: userId,
        deviceId,
        iat: issuedAtSeconds,
        exp: expiresAtSeconds,
      };

      if (jwtIssuer) {
        tokenPayload.iss = jwtIssuer;
      }

      if (jwtAudience) {
        tokenPayload.aud = jwtAudience;
      }

      const token = createJwt(tokenPayload, jwtSecret);
      const tokenExpiresAt = new Date(expiresAtSeconds * 1000).toISOString();

      return {
        userId,
        deviceId,
        token,
        tokenExpiresAt,
      };
    });
  };

  return {
    registerDevice,
  };
};

export type DeviceAuthService = ReturnType<typeof createDeviceAuthService>;
