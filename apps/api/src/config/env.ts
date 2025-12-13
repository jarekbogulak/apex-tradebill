import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { resolveApeXCredentials, type ApeXCredentials } from './apexConfig.js';

const DEFAULT_JWT_ISSUER = 'apex-tradebill';
const DEFAULT_JWT_AUDIENCE = 'apex-tradebill-clients';
const DEFAULT_DEV_JWT_SECRET = 'dev-jwt-secret-change-me';
const DEFAULT_DEV_DEVICE_ACTIVATION_SECRET = 'dev-device-activation-secret';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const ENV_FILES = ['.env', '.env.local'];

const COMMENT_PATTERN = /\s+#.*$/;

const parseEnvContent = (content: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine || rawLine.trimStart().startsWith('#')) {
      continue;
    }

    const match = rawLine.match(/^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? '';
    value = value.trim();

    if (!value) {
      entries[key] = '';
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      }
      entries[key] = value;
      continue;
    }

    const commentIndex = value.search(COMMENT_PATTERN);
    if (commentIndex >= 0) {
      value = value.slice(0, commentIndex).trim();
    }

    entries[key] = value;
  }

  return entries;
};

const applyEnvOverrides = (fullPath: string) => {
  const content = fs.readFileSync(fullPath, 'utf-8');
  const parsed = parseEnvContent(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

const loadEnvFile = (fileName: string) => {
  const fullPath = path.join(projectRoot, fileName);
  if (!fs.existsSync(fullPath)) {
    return;
  }

  // Only use file-based env in non-production to avoid clobbering deployment secrets.
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    applyEnvOverrides(fullPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to load ${fileName}: ${reason}`);
  }
};

for (const file of ENV_FILES) {
  // Load base .env first, then allow .env.local overrides.
  loadEnvFile(file);
}

const toInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
};

const normalizeSslMode = (value: string | undefined): DatabaseSslMode => {
  if (!value) {
    return 'auto';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'disable') {
    return 'disable';
  }
  if (normalized === 'require') {
    return 'require';
  }
  return 'auto';
};

const connectionString = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid database connection string');

const envSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  logLevel: z.string(),
  shutdownTimeoutMs: z.number().int().positive(),
  jwtSecret: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').optional(),
  jwtIssuer: z.string().optional(),
  jwtAudience: z.string().optional(),
  allowGuestAuth: z.boolean().nullable(),
  allowInMemoryDb: z.boolean().nullable(),
  allowInMemoryMarketData: z.boolean().nullable(),
  supabaseDbUrl: connectionString.optional(),
  databaseUrl: connectionString.optional(),
  supabaseDbPoolMin: z.number().int().min(0),
  supabaseDbPoolMax: z.number().int().min(1),
  supabaseDbIdleTimeoutMs: z.number().int().positive(),
  supabaseDbApplication: z.string(),
  supabaseDbSsl: z.enum(['auto', 'disable', 'require']),
  deviceActivationSecret: z.string().min(16, 'APEX_DEVICE_ACTIVATION_SECRET must be at least 16 characters long').optional(),
  gcpProjectId: z.string().min(1).optional(),
  omniBreakglassPublicKey: z.string().min(1).optional(),
  omniBreakglassPrivateKey: z.string().min(1).optional(),
  omniCacheTtlSeconds: z.number().int().positive(),
  omniAllowLatestVersion: z.boolean().nullable(),
});

const parseEnv = () => {
  return envSchema.parse({
    nodeEnv: (process.env.NODE_ENV ?? 'development').toLowerCase(),
    host: process.env.HOST ?? '0.0.0.0',
    port: toInteger(process.env.PORT, 4000),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    shutdownTimeoutMs: toInteger(process.env.SHUTDOWN_TIMEOUT_MS, 1000),
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: process.env.JWT_ISSUER,
    jwtAudience: process.env.JWT_AUDIENCE,
    allowGuestAuth:
      process.env.APEX_TRADEBILL_AUTH_ALLOW_GUEST == null
        ? null
        : toBoolean(process.env.APEX_TRADEBILL_AUTH_ALLOW_GUEST, false),
    allowInMemoryDb:
      process.env.APEX_ALLOW_IN_MEMORY_DB == null
        ? null
        : toBoolean(process.env.APEX_ALLOW_IN_MEMORY_DB, false),
    allowInMemoryMarketData:
      process.env.APEX_ALLOW_IN_MEMORY_MARKET_DATA == null
        ? null
        : toBoolean(process.env.APEX_ALLOW_IN_MEMORY_MARKET_DATA, false),
    supabaseDbUrl: process.env.SUPABASE_DB_URL,
    databaseUrl: process.env.DATABASE_URL,
    supabaseDbPoolMin: toInteger(process.env.SUPABASE_DB_POOL_MIN, 0),
    supabaseDbPoolMax: toInteger(process.env.SUPABASE_DB_POOL_MAX, 10),
    supabaseDbIdleTimeoutMs: toInteger(process.env.SUPABASE_DB_IDLE_TIMEOUT_MS, 30_000),
    supabaseDbApplication: process.env.SUPABASE_DB_APPLICATION ?? 'apex-tradebill-api',
    supabaseDbSsl: normalizeSslMode(process.env.SUPABASE_DB_SSL),
    deviceActivationSecret: process.env.APEX_DEVICE_ACTIVATION_SECRET,
    gcpProjectId: process.env.GCP_PROJECT_ID,
    omniBreakglassPublicKey: process.env.OMNI_BREAKGLASS_PUBLIC_KEY,
    omniBreakglassPrivateKey: process.env.OMNI_BREAKGLASS_PRIVATE_KEY,
    omniCacheTtlSeconds: toInteger(process.env.OMNI_CACHE_TTL_SECONDS, 300),
    omniAllowLatestVersion:
      process.env.OMNI_ALLOW_LATEST_VERSION == null
        ? null
        : toBoolean(process.env.OMNI_ALLOW_LATEST_VERSION, true),
  });
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type DatabaseSslMode = 'auto' | 'disable' | 'require';

export interface DatabaseConfig {
  url: string | null;
  allowInMemory: boolean;
  pool: {
    min: number;
    max: number;
    idleTimeoutMs: number;
    applicationName: string;
  };
  sslMode: DatabaseSslMode;
}

export interface AuthConfig {
  jwtSecret: string;
  issuer?: string;
  audience?: string;
  allowGuest: boolean;
  deviceActivationSecret: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  logLevel: string;
  shutdownTimeoutMs: number;
}

export interface ApexConfig {
  credentials: ApeXCredentials | null;
  allowInMemoryMarketData: boolean;
}

export interface OmniSecretsConfig {
  gcpProjectId: string | null;
  breakglassPublicKey: string | null;
  breakglassPrivateKey: string | null;
  cacheTtlSeconds: number;
  environment: 'production' | 'test';
  allowLatestVersion: boolean;
}

export interface AppEnv {
  nodeEnv: 'development' | 'test' | 'production';
  server: ServerConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  apex: ApexConfig;
  omniSecrets: OmniSecretsConfig;
}

const buildEnv = (): AppEnv => {
  const parsed = parseEnv();
  const apexCredentials = resolveApeXCredentials();

  const resolvedJwtSecret =
    parsed.jwtSecret ?? (parsed.nodeEnv === 'production' ? null : DEFAULT_DEV_JWT_SECRET);

  if (!resolvedJwtSecret) {
    throw new ConfigError(
      'JWT secret is missing. Set JWT_SECRET (use GSM in production).',
    );
  }

  if (resolvedJwtSecret.length < 16) {
    throw new ConfigError('JWT secret must be at least 16 characters long.');
  }

  const resolvedDeviceActivationSecret =
    parsed.deviceActivationSecret ??
    (parsed.nodeEnv === 'production' ? null : DEFAULT_DEV_DEVICE_ACTIVATION_SECRET);

  if (!resolvedDeviceActivationSecret) {
    throw new ConfigError(
      'APEX_DEVICE_ACTIVATION_SECRET is missing. Provision a dedicated device activation secret (GSM in production).',
    );
  }

  const resolvedIssuer =
    parsed.jwtIssuer ??
    (apexCredentials ? `apex-tradebill:${apexCredentials.environment}` : DEFAULT_JWT_ISSUER);
  if (!parsed.jwtIssuer && parsed.nodeEnv === 'production') {
    console.warn(`JWT_ISSUER missing – defaulting to "${resolvedIssuer}".`);
  }

  const resolvedAudience =
    parsed.jwtAudience ??
    (apexCredentials
      ? `apex-tradebill:${apexCredentials.environment}:clients`
      : DEFAULT_JWT_AUDIENCE);
  if (!parsed.jwtAudience && parsed.nodeEnv === 'production') {
    console.warn(`JWT_AUDIENCE missing – defaulting to "${resolvedAudience}".`);
  }

  const resolvedAllowGuest =
    parsed.allowGuestAuth ?? (parsed.nodeEnv === 'production' ? false : true);
  if (resolvedAllowGuest && parsed.nodeEnv === 'production') {
    console.warn('APEX_TRADEBILL_AUTH_ALLOW_GUEST enabled in production.');
  }

  const resolvedAllowInMemoryDb =
    parsed.allowInMemoryDb ?? (parsed.nodeEnv === 'production' ? false : true);
  if (resolvedAllowInMemoryDb && parsed.nodeEnv === 'production') {
    console.warn('APEX_ALLOW_IN_MEMORY_DB enabled in production.');
  }

  const resolvedAllowInMemoryMarketData =
    parsed.allowInMemoryMarketData ?? (parsed.nodeEnv === 'production' ? false : true);
  if (resolvedAllowInMemoryMarketData && parsed.nodeEnv === 'production') {
    console.warn('APEX_ALLOW_IN_MEMORY_MARKET_DATA enabled in production.');
  }

  const databaseUrl = parsed.supabaseDbUrl ?? parsed.databaseUrl ?? null;

  if (!databaseUrl && !resolvedAllowInMemoryDb) {
    throw new ConfigError(
      'Database URL is missing. Set SUPABASE_DB_URL (or DATABASE_URL) or enable APEX_ALLOW_IN_MEMORY_DB=true.',
    );
  }

  if (!apexCredentials && !resolvedAllowInMemoryMarketData && !parsed.gcpProjectId) {
    throw new ConfigError(
      'ApeX Omni credentials are missing. Provide APEX_OMNI_* values, enable APEX_ALLOW_IN_MEMORY_MARKET_DATA=true, or configure GCP_PROJECT_ID for Secret Manager.',
    );
  }

  const resolvedCacheTtlSeconds = parsed.omniCacheTtlSeconds;
  const resolvedGcpProjectId = parsed.gcpProjectId ?? null;
  const resolvedBreakglassKey = parsed.omniBreakglassPublicKey ?? null;
  const resolvedBreakglassPrivateKey = parsed.omniBreakglassPrivateKey ?? null;
  const resolvedAllowLatestVersion = parsed.omniAllowLatestVersion ?? true;
  const omniEnvironment =
    parsed.nodeEnv === 'production' || process.env.APEX_OMNI_ENVIRONMENT === 'prod'
      ? 'production'
      : 'test';

  if (parsed.nodeEnv === 'production') {
    if (!resolvedGcpProjectId) {
      throw new ConfigError('GCP_PROJECT_ID is required in production to access Google Secret Manager.');
    }
    if (!resolvedBreakglassKey) {
      throw new ConfigError(
        'OMNI_BREAKGLASS_PUBLIC_KEY is required in production for encrypted break-glass overrides.',
      );
    }
    if (!resolvedBreakglassPrivateKey) {
      throw new ConfigError(
        'OMNI_BREAKGLASS_PRIVATE_KEY is required in production to decrypt break-glass payloads.',
      );
    }
  }

  if (parsed.nodeEnv !== 'production' && omniEnvironment === 'production' && resolvedGcpProjectId) {
    throw new ConfigError(
      'Non-production environments cannot point at production Google Secret Manager secrets. Update GCP_PROJECT_ID or APEX_OMNI_ENVIRONMENT.',
    );
  }

  return {
    nodeEnv: parsed.nodeEnv,
    server: {
      host: parsed.host,
      port: parsed.port,
      logLevel: parsed.logLevel,
      shutdownTimeoutMs: parsed.shutdownTimeoutMs,
    },
    auth: {
      jwtSecret: resolvedJwtSecret,
      issuer: resolvedIssuer,
      audience: resolvedAudience,
      allowGuest: resolvedAllowGuest,
      deviceActivationSecret: resolvedDeviceActivationSecret,
    },
    database: {
      url: databaseUrl,
      allowInMemory: resolvedAllowInMemoryDb,
      pool: {
        min: parsed.supabaseDbPoolMin,
        max: parsed.supabaseDbPoolMax,
        idleTimeoutMs: parsed.supabaseDbIdleTimeoutMs,
        applicationName: parsed.supabaseDbApplication,
      },
      sslMode: parsed.supabaseDbSsl,
    },
    apex: {
      credentials: apexCredentials,
      allowInMemoryMarketData: resolvedAllowInMemoryMarketData,
    },
    omniSecrets: {
      gcpProjectId: resolvedGcpProjectId,
      breakglassPublicKey: resolvedBreakglassKey,
      breakglassPrivateKey: resolvedBreakglassPrivateKey,
      cacheTtlSeconds: resolvedCacheTtlSeconds,
      environment: omniEnvironment,
      allowLatestVersion: resolvedAllowLatestVersion,
    },
  };
};

export const env = buildEnv();
export const rebuildEnv = buildEnv;
