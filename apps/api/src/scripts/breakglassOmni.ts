import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { box, box_keyPair, randomBytes } from 'tweetnacl-ts';

interface CliOptions {
  secretType: string;
  secretValue?: string;
  secretValueFile?: string;
  ttlMinutes: number;
  apiUrl: string;
  token: string;
  publicKey: string;
}

const DEFAULT_API_URL = process.env.OMNI_BREAKGLASS_API_URL ?? 'http://localhost:4000';
const DEFAULT_PUBLIC_KEY = process.env.OMNI_BREAKGLASS_PUBLIC_KEY ?? '';
const MAX_TTL_MINUTES = 30;
const encoder = new TextEncoder();
const BOX_PUBLIC_KEY_LENGTH = 32;
const BOX_NONCE_LENGTH = 24;

const parseDurationToMinutes = (value: string | undefined): number => {
  if (!value) {
    return MAX_TTL_MINUTES / 2;
  }

  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)([smhd])?$/);
  if (!match) {
    return MAX_TTL_MINUTES / 2;
  }
  const amount = Number.parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? 'm';
  if (!Number.isFinite(amount) || amount <= 0) {
    return MAX_TTL_MINUTES / 2;
  }

  switch (unit) {
    case 's':
      return amount / 60;
    case 'h':
      return amount * 60;
    case 'd':
      return amount * 24 * 60;
    default:
      return amount;
  }
};

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  let secretType: string | undefined;
  let secretValue: string | undefined;
  let secretValueFile: string | undefined;
  let ttlMinutes = MAX_TTL_MINUTES / 2;
  let apiUrl = DEFAULT_API_URL;
  let token = process.env.OMNI_BREAKGLASS_TOKEN ?? '';
  let publicKey = DEFAULT_PUBLIC_KEY;

  let pendingKey:
    | 'secret'
    | 'secretValue'
    | 'secretValueFile'
    | 'ttl'
    | 'apiUrl'
    | 'token'
    | 'publicKey'
    | null = null;

  for (const arg of args) {
    if (pendingKey) {
      switch (pendingKey) {
        case 'secret':
          secretType = arg;
          break;
        case 'secretValue':
          secretValue = arg;
          break;
        case 'secretValueFile':
          secretValueFile = arg;
          break;
        case 'ttl':
          ttlMinutes = parseDurationToMinutes(arg);
          break;
        case 'apiUrl':
          apiUrl = arg;
          break;
        case 'token':
          token = arg;
          break;
        case 'publicKey':
          publicKey = arg;
          break;
        default:
          break;
      }
      pendingKey = null;
      continue;
    }

    const [key, inlineValue] = arg.includes('=') ? arg.split('=', 2) : [arg, undefined];

    const assign = (value: string | undefined, setter: (v: string) => void, pending: typeof pendingKey) => {
      if (value != null) {
        setter(value);
        return;
      }
      pendingKey = pending;
    };

    switch (key) {
      case '--secretType':
      case '--secret-type':
      case '-s':
        assign(inlineValue, (val) => {
          secretType = val;
        }, 'secret');
        continue;
      case '--ciphertext':
      case '--secret-value':
        assign(inlineValue, (val) => {
          secretValue = val;
        }, 'secretValue');
        continue;
      case '--ciphertext-file':
      case '--secret-value-file':
        assign(inlineValue, (val) => {
          secretValueFile = val;
        }, 'secretValueFile');
        continue;
      case '--ttl':
        assign(inlineValue, (val) => {
          ttlMinutes = parseDurationToMinutes(val);
        }, 'ttl');
        continue;
      case '--api-url':
        assign(inlineValue, (val) => {
          apiUrl = val;
        }, 'apiUrl');
        continue;
      case '--token':
        assign(inlineValue, (val) => {
          token = val;
        }, 'token');
        continue;
      case '--public-key':
        assign(inlineValue, (val) => {
          publicKey = val;
        }, 'publicKey');
        continue;
      default:
        break;
    }

    if (!secretType && !key.startsWith('-')) {
      secretType = key;
    }
  }

  if (pendingKey === 'secret') {
    throw new Error('Missing value for --secretType');
  }
  if (pendingKey === 'secretValue') {
    throw new Error('Missing value for --secret-value');
  }
  if (pendingKey === 'secretValueFile') {
    throw new Error('Missing value for --secret-value-file');
  }
  if (pendingKey === 'ttl') {
    throw new Error('Missing value for --ttl');
  }
  if (pendingKey === 'apiUrl') {
    throw new Error('Missing value for --api-url');
  }
  if (pendingKey === 'token') {
    throw new Error('Missing value for --token');
  }
  if (pendingKey === 'publicKey') {
    throw new Error('Missing value for --public-key');
  }

  if (!secretType) {
    throw new Error('secretType is required. Pass --secretType <name>');
  }

  if (!token) {
    throw new Error('OMNI_BREAKGLASS_TOKEN env or --token is required for authentication');
  }

  if (!publicKey) {
    throw new Error('OMNI_BREAKGLASS_PUBLIC_KEY env or --public-key is required for encryption');
  }

  ttlMinutes = Math.min(Math.max(ttlMinutes, 1), MAX_TTL_MINUTES);

  return {
    secretType,
    secretValue,
    secretValueFile,
    ttlMinutes,
    apiUrl,
    token,
    publicKey,
  };
};

const resolveSecretValue = (options: CliOptions): string => {
  if (options.secretValue) {
    return options.secretValue;
  }
  if (options.secretValueFile) {
    const fullPath = path.resolve(options.secretValueFile);
    return fs.readFileSync(fullPath, 'utf-8').trim();
  }
  throw new Error(
    'secret value missing. Provide --secret-value <value> or --secret-value-file <path>',
  );
};

const encryptBreakGlassPayload = (value: string, publicKeyBase64: string): string => {
  const recipientPublicKey = new Uint8Array(Buffer.from(publicKeyBase64, 'base64'));
  if (recipientPublicKey.length !== BOX_PUBLIC_KEY_LENGTH) {
    throw new Error('OMNI_BREAKGLASS_PUBLIC_KEY must be a 32-byte Curve25519 key (base64).');
  }

  const nonce = randomBytes(BOX_NONCE_LENGTH);
  const ephemeral = box_keyPair();
  const cipher = box(encoder.encode(value), nonce, recipientPublicKey, ephemeral.secretKey);
  if (!cipher) {
    throw new Error('Failed to encrypt break-glass payload.');
  }

  const envelope = {
    version: 1,
    nonce: Buffer.from(nonce).toString('base64'),
    ephemeralPublicKey: Buffer.from(ephemeral.publicKey).toString('base64'),
    ciphertext: Buffer.from(cipher).toString('base64'),
  };

  return Buffer.from(JSON.stringify(envelope)).toString('base64');
};

const postJson = async (endpoint: string, payload: Record<string, unknown>, token: string) => {
  const url = new URL(endpoint);
  const module = url.protocol === 'https:' ? https : http;

  return await new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = module.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            if (!body) {
              resolve({});
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(new Error(`Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`));
            }
          } else {
            reject(new Error(`API responded with ${response.statusCode}: ${body}`));
          }
        });
      },
    );

    request.on('error', reject);
    request.write(JSON.stringify(payload));
    request.end();
  });
};

const main = async () => {
  try {
    const options = parseArgs();
    const secretValue = resolveSecretValue(options);
    const ciphertext = encryptBreakGlassPayload(secretValue, options.publicKey);
    const expiresAt = new Date(Date.now() + options.ttlMinutes * 60_000).toISOString();

    const payload = await postJson(
      `${options.apiUrl}/ops/apex-omni/secrets/break-glass`,
      {
        secretType: options.secretType,
        ciphertext,
        expiresAt,
      },
      options.token,
    );
    process.stdout.write('Break-glass secret submitted successfully.\n');
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Break-glass submission failed: ${message}\n`);
    process.exitCode = 1;
  }
};

void main();
