import type { OmniSecretRepository, OmniSecretMetadataUpdates } from './repository.js';
import type { OmniSecretCache, CachedSecret, CacheFetchResult } from './cache.js';
import type { GsmSecretManagerClient } from './gsmClient.js';
import { box_open } from 'tweetnacl-ts';
import {
  CacheSourceSchema,
  type CacheSource,
  type OmniSecretMetadata,
  SecretTypeSchema,
} from './types.js';
import type { OmniSecretsTelemetry } from '@api/observability/omniSecretsTelemetry.js';
import type { OmniSecretsAlerts } from '@api/observability/alerts/omniSecrets.js';

export interface OmniSecretServiceDeps {
  repository: OmniSecretRepository;
  cache: OmniSecretCache;
  gsmClient: GsmSecretManagerClient;
  breakglassPrivateKey?: string | null;
  allowLatestVersion?: boolean;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
  };
  telemetry?: OmniSecretsTelemetry;
  alerts?: OmniSecretsAlerts;
}

export interface StatusEntry {
  secretType: string;
  status: string;
  cacheSource: CacheSource;
  cacheVersion?: string | null;
  cacheAgeSeconds: number | null;
  rotationDueAt?: string;
  lastRotatedAt?: string | null;
  lastValidatedAt?: string | null;
  breakGlassEnabledUntil?: string | null;
}

export interface StatusSummary {
  data: StatusEntry[];
  updatedAt: string;
}

export interface RotationPreviewInput {
  secretType: string;
  gcpSecretVersion?: string;
}

export interface RotationPreviewResult {
  validated: boolean;
  latencyMs: number;
  version: string;
}

export interface CacheRefreshInput {
  secretType?: string;
}

export interface CacheRefreshResult {
  refreshedSecretTypes: string[];
}

export interface BreakGlassInput {
  secretType: string;
  ciphertext: string;
  expiresAt: string;
  actorId: string;
}

export interface BreakGlassResult {
  secretType: string;
  expiresAt: string;
}

export interface SecretValueResult {
  secretType: string;
  value: string;
  version: string;
  source: CacheSource;
}

export class RotationInProgressError extends Error {
  constructor(secretType: string) {
    super(`Rotation already in progress for ${secretType}`);
    this.name = 'RotationInProgressError';
  }
}

export class SecretUnavailableError extends Error {
  constructor(secretType: string, reason: string) {
    super(`Secret ${secretType} unavailable: ${reason}`);
    this.name = 'SecretUnavailableError';
  }
}

export class InvalidBreakGlassTtlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBreakGlassTtlError';
  }
}

export class InvalidBreakGlassPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBreakGlassPayloadError';
  }
}

const MAX_BREAK_GLASS_TTL_MS = 30 * 60 * 1000;
const decoder = new TextDecoder();
const BOX_SECRET_KEY_LENGTH = 32;
const BOX_PUBLIC_KEY_LENGTH = 32;
const BOX_NONCE_LENGTH = 24;

interface BreakGlassEnvelope {
  version: number;
  nonce: string;
  ephemeralPublicKey: string;
  ciphertext: string;
}

const decodeBase64ToUint8 = (value: string): Uint8Array => {
  return new Uint8Array(Buffer.from(value, 'base64'));
};

const mapCacheToStatus = (
  metadata: OmniSecretMetadata,
  cached: CachedSecret | null,
  telemetry?: OmniSecretsTelemetry,
): StatusEntry => {
  const cacheAgeSeconds =
    cached && cached.fetchedAt ? Math.max(0, Math.floor((Date.now() - cached.fetchedAt) / 1000)) : null;

  const cacheSource = cached?.source ?? metadata.cacheSource ?? 'empty';
  const safeSource = CacheSourceSchema.safeParse(cacheSource).success ? (cacheSource as CacheSource) : 'empty';
  telemetry?.setCacheAge(metadata.secretType, safeSource, cacheAgeSeconds);
  return {
    secretType: metadata.secretType,
    status: metadata.status,
    cacheSource: safeSource,
    cacheVersion: cached?.version ?? metadata.cacheVersion,
    cacheAgeSeconds,
    rotationDueAt: metadata.rotationDueAt,
    lastRotatedAt: metadata.lastRotatedAt ?? null,
    lastValidatedAt: metadata.lastValidatedAt ?? null,
    breakGlassEnabledUntil: metadata.breakGlassEnabledUntil ?? null,
  };
};

export const createOmniSecretService = ({
  repository,
  cache,
  gsmClient,
  breakglassPrivateKey: breakglassPrivateKeyBase64,
  allowLatestVersion: allowLatestVersionInput,
  logger,
  telemetry,
  alerts,
}: OmniSecretServiceDeps) => {
  const log = logger ?? {
    info: () => {},
    warn: () => {},
  };
  const allowLatestVersion = allowLatestVersionInput ?? true;

  const decodedBreakglassPrivateKey =
    breakglassPrivateKeyBase64 && breakglassPrivateKeyBase64.length > 0
      ? decodeBase64ToUint8(breakglassPrivateKeyBase64)
      : null;

  if (decodedBreakglassPrivateKey && decodedBreakglassPrivateKey.length !== BOX_SECRET_KEY_LENGTH) {
    throw new Error('Invalid OMNI_BREAKGLASS_PRIVATE_KEY length; expected Curve25519 private key.');
  }

  const ensureSecret = async (secretType: string): Promise<OmniSecretMetadata> => {
    const parsedType = SecretTypeSchema.parse(secretType);
    const metadata = await repository.getMetadata(parsedType);
    if (!metadata) {
      throw new SecretUnavailableError(parsedType, 'metadata missing');
    }
    return metadata;
  };

  const updateMetadata = (secretType: string, updates: OmniSecretMetadataUpdates) => {
    return repository.updateMetadata(secretType, updates);
  };

  const resolveGcpVersion = (metadata: OmniSecretMetadata, override?: string): string => {
    const version = override ?? metadata.gcpVersionAlias ?? 'latest';
    if (!allowLatestVersion && version === 'latest') {
      throw new SecretUnavailableError(
        metadata.secretType,
        'latest version alias is disabled by OMNI_ALLOW_LATEST_VERSION=false',
      );
    }
    return version;
  };

  const decryptBreakGlassPayload = (ciphertext: string, secretType: string): string => {
    if (!decodedBreakglassPrivateKey) {
      throw new SecretUnavailableError(secretType, 'break-glass private key unavailable');
    }

    let envelope: BreakGlassEnvelope;
    try {
      const decoded = Buffer.from(ciphertext, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as Partial<BreakGlassEnvelope>;
      if (
        typeof parsed.nonce !== 'string' ||
        typeof parsed.ephemeralPublicKey !== 'string' ||
        typeof parsed.ciphertext !== 'string'
      ) {
        throw new Error('Missing envelope fields');
      }
      envelope = {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        nonce: parsed.nonce,
        ephemeralPublicKey: parsed.ephemeralPublicKey,
        ciphertext: parsed.ciphertext,
      };
    } catch (error) {
      throw new InvalidBreakGlassPayloadError(
        `Invalid break-glass payload: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const nonce = decodeBase64ToUint8(envelope.nonce);
    const ephemeralPublicKey = decodeBase64ToUint8(envelope.ephemeralPublicKey);
    const cipherBytes = decodeBase64ToUint8(envelope.ciphertext);

    if (nonce.length !== BOX_NONCE_LENGTH || ephemeralPublicKey.length !== BOX_PUBLIC_KEY_LENGTH) {
      throw new InvalidBreakGlassPayloadError('Invalid break-glass envelope sizing.');
    }

    const plaintext = box_open(cipherBytes, nonce, ephemeralPublicKey, decodedBreakglassPrivateKey);
    if (!plaintext) {
      throw new InvalidBreakGlassPayloadError('Unable to decrypt break-glass payload.');
    }

    return decoder.decode(plaintext);
  };

  const getStatus = async (): Promise<StatusSummary> => {
    const entries = await repository.listMetadata();
    const data = entries.map((metadata) => {
      const cached = cache.getCached(metadata.secretType);
      return mapCacheToStatus(metadata, cached, telemetry);
    });
    return {
      data,
      updatedAt: new Date().toISOString(),
    };
  };

  const rotationPreview = async ({
    secretType,
    gcpSecretVersion,
  }: RotationPreviewInput): Promise<RotationPreviewResult> => {
    const metadata = await ensureSecret(secretType);

    if (metadata.status === 'rotating') {
      throw new RotationInProgressError(secretType);
    }

    const result = await gsmClient.accessSecretVersion(
      metadata.gcpSecretId,
      resolveGcpVersion(metadata, gcpSecretVersion),
    );

    await updateMetadata(secretType, {
      gcpVersionAlias: result.version,
      status: 'active',
      lastValidatedAt: new Date().toISOString(),
    });

    await repository.recordAccessEvent({
      secretType: metadata.secretType,
      action: 'rotation_preview',
      actorType: 'operator_cli',
      actorId: 'omni-ops',
      result: 'success',
      gcpSecretVersion: result.version,
      durationMs: result.durationMs,
    });

    return {
      validated: true,
      latencyMs: result.durationMs,
      version: result.version,
    };
  };

  const refreshCache = async ({ secretType }: CacheRefreshInput): Promise<CacheRefreshResult> => {
    const entries = secretType ? [await ensureSecret(secretType)] : await repository.listMetadata();
    const refreshed: string[] = [];

    for (const entry of entries) {
      try {
        const targetEntry = {
          ...entry,
          gcpVersionAlias: resolveGcpVersion(entry),
        };
        const { entry: cached, durationMs }: CacheFetchResult = await cache.refresh(targetEntry);
        refreshed.push(entry.secretType);
        await updateMetadata(entry.secretType, {
          cacheSource: cached.source,
          cacheVersion: cached.version,
        });
        telemetry?.recordSecretRead(entry.secretType, cached.source, durationMs);
        telemetry?.setCacheAge(entry.secretType, cached.source, 0);
        alerts?.resetFailure(entry.secretType);
        await repository.recordAccessEvent({
          secretType: entry.secretType,
          action: 'cache_refresh',
          actorType: 'service',
          actorId: 'omni-cache',
          result: 'success',
          gcpSecretVersion: cached.version,
          durationMs,
        });
      } catch (error) {
        log.warn?.('omni.cache_refresh_failed', { err: error, secretType: entry.secretType });
        cache.markEmpty(entry.secretType);
        await updateMetadata(entry.secretType, {
          cacheSource: 'empty',
          cacheVersion: null,
        });
        telemetry?.recordSecretFailure(entry.secretType, 'gsm_unavailable');
        alerts?.recordCacheFailure(entry.secretType, 'gsm_unavailable');
        await repository.recordAccessEvent({
          secretType: entry.secretType,
          action: 'cache_refresh',
          actorType: 'service',
          actorId: 'omni-cache',
          result: 'failure',
          errorCode: 'GSM_UNAVAILABLE',
        });
      }
    }

    return {
      refreshedSecretTypes: refreshed,
    };
  };

  const applyBreakGlass = async ({ secretType, ciphertext, expiresAt, actorId }: BreakGlassInput): Promise<BreakGlassResult> => {
    if (!ciphertext) {
      throw new InvalidBreakGlassTtlError('ciphertext payload is required');
    }
    const metadata = await ensureSecret(secretType);
    const expiresAtDate = new Date(expiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) {
      throw new InvalidBreakGlassTtlError('expiresAt must be a valid ISO timestamp');
    }
    const ttlMs = expiresAtDate.getTime() - Date.now();
    if (ttlMs <= 0) {
      throw new InvalidBreakGlassTtlError('expiresAt must be in the future');
    }
    if (ttlMs > MAX_BREAK_GLASS_TTL_MS) {
      throw new InvalidBreakGlassTtlError('Break-glass TTL cannot exceed 30 minutes');
    }

    const secretValue = decryptBreakGlassPayload(ciphertext, secretType);

    const cached = cache.setBreakGlass(metadata.secretType, secretValue, ttlMs);
    await updateMetadata(metadata.secretType, {
      breakGlassEnabledUntil: expiresAtDate.toISOString(),
      cacheSource: cached.source,
      cacheVersion: cached.version,
    });
    telemetry?.recordSecretRead(secretType, 'break_glass');
    telemetry?.setCacheAge(secretType, 'break_glass', ttlMs / 1000);
    alerts?.recordBreakGlass(secretType, expiresAtDate.toISOString());

    await repository.recordAccessEvent({
      secretType: metadata.secretType,
      action: 'break_glass_apply',
      actorType: 'operator_cli',
      actorId,
      result: 'success',
      gcpSecretVersion: cached.version,
    });

    return {
      secretType: metadata.secretType,
      expiresAt: expiresAtDate.toISOString(),
    };
  };

  const isSecretAvailable = async (secretType: string): Promise<boolean> => {
    const parsedType = SecretTypeSchema.parse(secretType);
    const metadata = await repository.getMetadata(parsedType);
    if (!metadata) {
      return false;
    }
    const cached = cache.getCached(parsedType);
    return Boolean(cached && cached.source !== 'empty');
  };

  const getSecretValue = async (secretType: string): Promise<SecretValueResult> => {
    const metadata = await ensureSecret(secretType);
    const parsedSecretType = metadata.secretType;
    const targetEntry: OmniSecretMetadata = {
      ...metadata,
      gcpVersionAlias: resolveGcpVersion(metadata),
    };

    try {
      const cached = await cache.getOrFetch(targetEntry);
      telemetry?.recordSecretRead(parsedSecretType, cached.source, 0);
      telemetry?.setCacheAge(parsedSecretType, cached.source, 0);
      await updateMetadata(parsedSecretType, {
        cacheSource: cached.source,
        cacheVersion: cached.version,
        lastValidatedAt: new Date().toISOString(),
      });
      await repository.recordAccessEvent({
        secretType: parsedSecretType,
        action: 'secret_read',
        actorType: 'service',
        actorId: 'omni-runtime',
        result: 'success',
        gcpSecretVersion: cached.version,
      });

      return {
        secretType: parsedSecretType,
        value: cached.value,
        version: cached.version,
        source: cached.source,
      };
    } catch (error) {
      telemetry?.recordSecretFailure(parsedSecretType, 'gsm_unavailable');
      alerts?.recordCacheFailure(parsedSecretType, 'gsm_unavailable');
      cache.markEmpty(parsedSecretType);
      await updateMetadata(parsedSecretType, {
        cacheSource: 'empty',
        cacheVersion: null,
      });
      await repository.recordAccessEvent({
        secretType: parsedSecretType,
        action: 'secret_read',
        actorType: 'service',
        actorId: 'omni-runtime',
        result: 'failure',
        errorCode: 'GSM_UNAVAILABLE',
      });
      throw new SecretUnavailableError(
        parsedSecretType,
        error instanceof Error ? error.message : 'gsm_unavailable',
      );
    }
  };

  return {
    getStatus,
    rotationPreview,
    refreshCache,
    applyBreakGlass,
    isSecretAvailable,
    getSecretValue,
    listMetadata: () => repository.listMetadata(),
  };
};

export type OmniSecretService = ReturnType<typeof createOmniSecretService>;
