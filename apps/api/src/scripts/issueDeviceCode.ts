import crypto from 'node:crypto';
import { buildDatabasePoolOptions } from '../config/database.js';
import { env } from '../config/env.js';
import {
  closeSharedDatabasePool,
  getSharedDatabasePool,
} from '../adapters/persistence/providers/postgres/pool.js';

interface CliOptions {
  deviceId: string;
  expiresInMinutes: number;
  json: boolean;
}

const DEFAULT_EXPIRY_MINUTES = 10;

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let deviceId: string | undefined;
  let expiresInMinutes = DEFAULT_EXPIRY_MINUTES;
  let json = false;
  let pendingKey: 'device' | 'expires' | null = null;

  for (const arg of args) {
    if (pendingKey) {
      if (pendingKey === 'device') {
        deviceId = arg;
      } else if (pendingKey === 'expires') {
        expiresInMinutes = Number.parseInt(arg, 10);
      }
      pendingKey = null;
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    const [key, value] = arg.includes('=') ? arg.split('=', 2) : [arg, undefined];

    switch (key) {
      case '--device':
      case '-d':
        if (value != null) {
          deviceId = value;
        } else {
          pendingKey = 'device';
        }
        continue;
      case '--expires-in':
      case '-e':
        if (value != null) {
          expiresInMinutes = Number.parseInt(value, 10);
        } else {
          pendingKey = 'expires';
        }
        continue;
      default:
        break;
    }

    if (!deviceId && key && !key.startsWith('-')) {
      deviceId = key;
    }
  }

  if (pendingKey === 'device') {
    throw new Error('Device identifier value missing for --device');
  }
  if (pendingKey === 'expires') {
    throw new Error('Expiration minutes missing for --expires-in');
  }

  if (!deviceId) {
    deviceId = `device-${crypto.randomUUID()}`;
  }

  if (!Number.isFinite(expiresInMinutes) || expiresInMinutes <= 0) {
    expiresInMinutes = DEFAULT_EXPIRY_MINUTES;
  }

  return {
    deviceId,
    expiresInMinutes,
    json,
  };
};

const toBase64Url = (input: string): string => {
  return Buffer.from(input, 'utf8').toString('base64url');
};

const issueActivationCode = async ({
  deviceId,
  expiresInMinutes,
}: {
  deviceId: string;
  expiresInMinutes: number;
}) => {
  const secret = env.auth.deviceActivationSecret;
  if (!secret) {
    throw new Error('APEX_DEVICE_ACTIVATION_SECRET is required to issue device codes.');
  }

  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000).toISOString();
  const codeId = crypto.randomUUID();

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

  const activationCode = `ATC1.${toBase64Url(JSON.stringify(payload))}`;

  const pool = await getSharedDatabasePool(buildDatabasePoolOptions());
  await pool.query(
    `
      INSERT INTO device_activation_codes (id, device_id, issued_at, expires_at, signature, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE
        SET device_id = EXCLUDED.device_id,
            issued_at = EXCLUDED.issued_at,
            expires_at = EXCLUDED.expires_at,
            signature = EXCLUDED.signature,
            created_at = device_activation_codes.created_at,
            consumed_at = NULL,
            consumed_by_device = NULL;
    `,
    [codeId, deviceId, issuedAt, expiresAt, signature],
  );

  return {
    deviceId,
    codeId,
    issuedAt,
    expiresAt,
    activationCode,
    payload,
  };
};

const main = async () => {
  let poolClosed = false;
  try {
    const options = parseArgs();
    const result = await issueActivationCode(options);

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            deviceId: result.deviceId,
            codeId: result.codeId,
            issuedAt: result.issuedAt,
            expiresAt: result.expiresAt,
            activationCode: result.activationCode,
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    process.stdout.write('Device activation code issued successfully.\n\n');
    process.stdout.write(`  Device ID:     ${result.deviceId}\n`);
    process.stdout.write(`  Code ID:       ${result.codeId}\n`);
    process.stdout.write(`  Issued at:     ${result.issuedAt}\n`);
    process.stdout.write(`  Expires at:    ${result.expiresAt}\n`);
    process.stdout.write('\n');
    process.stdout.write('Activation Code:\n');
    process.stdout.write(`${result.activationCode}\n`);
    process.stdout.write('\n');
    process.stdout.write(
      'Provide this code to the device and call POST /v1/auth/device/register with { deviceId, activationCode } before it expires.\n',
    );
    await closeSharedDatabasePool();
    poolClosed = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Failed to issue activation code: ${message}\n`);
    process.exitCode = 1;
  } finally {
    if (!poolClosed) {
      await closeSharedDatabasePool();
    }
  }
};

void main();
