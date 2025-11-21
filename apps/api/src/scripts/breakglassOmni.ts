import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

interface CliOptions {
  secretType: string;
  ciphertext?: string;
  ciphertextFile?: string;
  ttlMinutes: number;
  apiUrl: string;
  token: string;
}

const DEFAULT_API_URL = process.env.OMNI_BREAKGLASS_API_URL ?? 'http://localhost:4000';
const MAX_TTL_MINUTES = 30;

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
  let ciphertext: string | undefined;
  let ciphertextFile: string | undefined;
  let ttlMinutes = MAX_TTL_MINUTES / 2;
  let apiUrl = DEFAULT_API_URL;
  let token = process.env.OMNI_BREAKGLASS_TOKEN ?? '';

  let pendingKey:
    | 'secret'
    | 'ciphertext'
    | 'ciphertextFile'
    | 'ttl'
    | 'apiUrl'
    | 'token'
    | null = null;

  for (const arg of args) {
    if (pendingKey) {
      switch (pendingKey) {
        case 'secret':
          secretType = arg;
          break;
        case 'ciphertext':
          ciphertext = arg;
          break;
        case 'ciphertextFile':
          ciphertextFile = arg;
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
        assign(inlineValue, (val) => {
          ciphertext = val;
        }, 'ciphertext');
        continue;
      case '--ciphertext-file':
        assign(inlineValue, (val) => {
          ciphertextFile = val;
        }, 'ciphertextFile');
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
  if (pendingKey === 'ciphertext') {
    throw new Error('Missing value for --ciphertext');
  }
  if (pendingKey === 'ciphertextFile') {
    throw new Error('Missing value for --ciphertext-file');
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

  if (!secretType) {
    throw new Error('secretType is required. Pass --secretType <name>');
  }

  if (!token) {
    throw new Error('OMNI_BREAKGLASS_TOKEN env or --token is required for authentication');
  }

  ttlMinutes = Math.min(Math.max(ttlMinutes, 1), MAX_TTL_MINUTES);

  return {
    secretType,
    ciphertext,
    ciphertextFile,
    ttlMinutes,
    apiUrl,
    token,
  };
};

const resolveCiphertext = (options: CliOptions): string => {
  if (options.ciphertext) {
    return options.ciphertext;
  }
  if (options.ciphertextFile) {
    const fullPath = path.resolve(options.ciphertextFile);
    return fs.readFileSync(fullPath, 'utf-8').trim();
  }
  throw new Error('ciphertext missing. Provide --ciphertext <value> or --ciphertext-file <path>');
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
    const ciphertext = resolveCiphertext(options);
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
