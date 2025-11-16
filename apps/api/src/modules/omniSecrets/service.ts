import type { OmniSecretRepository, OmniSecretMetadataUpdates } from './repository.js';
import type { OmniSecretCache, CachedSecret } from './cache.js';
import type { GsmSecretManagerClient } from './gsmClient.js';
import {
  CacheSourceSchema,
  type CacheSource,
  type OmniSecretMetadata,
  SecretTypeSchema,
} from './types.js';

export interface OmniSecretServiceDeps {
  repository: OmniSecretRepository;
  cache: OmniSecretCache;
  gsmClient: GsmSecretManagerClient;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
  };
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

const MAX_BREAK_GLASS_TTL_MS = 30 * 60 * 1000;

const mapCacheToStatus = (metadata: OmniSecretMetadata, cached: CachedSecret | null): StatusEntry => {
  const cacheAgeSeconds =
    cached && cached.fetchedAt ? Math.max(0, Math.floor((Date.now() - cached.fetchedAt) / 1000)) : null;

  const cacheSource = cached?.source ?? metadata.cacheSource ?? 'empty';
  const safeSource = CacheSourceSchema.safeParse(cacheSource).success ? (cacheSource as CacheSource) : 'empty';
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
  logger,
}: OmniSecretServiceDeps) => {
  const log = logger ?? {
    info: () => {},
    warn: () => {},
  };

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

  const getStatus = async (): Promise<StatusSummary> => {
    const entries = await repository.listMetadata();
    const data = entries.map((metadata) => {
      const cached = cache.getCached(metadata.secretType);
      return mapCacheToStatus(metadata, cached);
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
      gcpSecretVersion ?? metadata.gcpVersionAlias ?? 'latest',
    );

    await updateMetadata(secretType, {
      gcpVersionAlias: result.version,
      status: 'active',
      lastValidatedAt: new Date().toISOString(),
    });

    await repository.recordAccessEvent({
      secretType,
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
        const cached = await cache.refresh(entry);
        refreshed.push(entry.secretType);
        await updateMetadata(entry.secretType, {
          cacheSource: cached.source,
          cacheVersion: cached.version,
        });
        await repository.recordAccessEvent({
          secretType: entry.secretType,
          action: 'cache_refresh',
          actorType: 'service',
          actorId: 'omni-cache',
          result: 'success',
          gcpSecretVersion: cached.version,
          durationMs: cached.expiresAt - cached.fetchedAt,
        });
      } catch (error) {
        log.warn?.('omni.cache_refresh_failed', { err: error, secretType: entry.secretType });
        cache.markEmpty(entry.secretType);
        await updateMetadata(entry.secretType, {
          cacheSource: 'empty',
          cacheVersion: null,
        });
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

    const cached = cache.setBreakGlass(metadata.secretType, ciphertext, ttlMs);
    await updateMetadata(metadata.secretType, {
      breakGlassEnabledUntil: expiresAtDate.toISOString(),
      cacheSource: cached.source,
      cacheVersion: cached.version,
    });

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
    const metadata = await repository.getMetadata(secretType);
    if (!metadata) {
      return false;
    }
    const cached = cache.getCached(secretType);
    return Boolean(cached && cached.source !== 'empty');
  };

  return {
    getStatus,
    rotationPreview,
    refreshCache,
    applyBreakGlass,
    isSecretAvailable,
    listMetadata: () => repository.listMetadata(),
  };
};

export type OmniSecretService = ReturnType<typeof createOmniSecretService>;
