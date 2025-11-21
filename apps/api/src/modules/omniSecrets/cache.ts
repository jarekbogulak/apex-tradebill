import type { CacheSource, OmniSecretMetadata } from './types.js';
import type { GsmSecretManagerClient } from './gsmClient.js';
import type { SecretFetchResult } from './gsmClient.js';

export interface OmniSecretCacheOptions {
  ttlMs: number;
  gsmClient: GsmSecretManagerClient;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
  };
}

export interface CachedSecret {
  value: string;
  version: string;
  source: CacheSource;
  fetchedAt: number;
  expiresAt: number;
}

export interface CacheFetchResult {
  entry: CachedSecret;
  durationMs: number;
}

export class OmniSecretCache {
  private readonly entries = new Map<string, CachedSecret>();
  private readonly ttlMs: number;
  private readonly gsmClient: GsmSecretManagerClient;
  private readonly logger: NonNullable<OmniSecretCacheOptions['logger']>;

  constructor(options: OmniSecretCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.gsmClient = options.gsmClient;
    this.logger =
      options.logger ??
      ({
        info: () => {},
        warn: () => {},
      } as NonNullable<OmniSecretCacheOptions['logger']>);
  }

  private setEntry(secretType: string, entry: CachedSecret) {
    this.entries.set(secretType, entry);
  }

  private isEntryValid(entry: CachedSecret | undefined): entry is CachedSecret {
    if (!entry) {
      return false;
    }
    return entry.expiresAt > Date.now();
  }

  getCached(secretType: string): CachedSecret | null {
    const entry = this.entries.get(secretType);
    if (this.isEntryValid(entry)) {
      return entry;
    }
    return null;
  }

  async fetchFromGsm(metadata: OmniSecretMetadata): Promise<CacheFetchResult> {
    const secret: SecretFetchResult = await this.gsmClient.accessSecretVersion(
      metadata.gcpSecretId,
      metadata.gcpVersionAlias ?? 'latest',
    );

    const now = Date.now();
    const entry: CachedSecret = {
      value: secret.value,
      version: secret.version,
      source: 'gsm',
      fetchedAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.setEntry(metadata.secretType, entry);
    return { entry, durationMs: secret.durationMs };
  }

  async getOrFetch(metadata: OmniSecretMetadata): Promise<CachedSecret> {
    const cached = this.getCached(metadata.secretType);
    if (cached) {
      return cached;
    }
    const result = await this.fetchFromGsm(metadata);
    return result.entry;
  }

  async refresh(metadata: OmniSecretMetadata): Promise<CacheFetchResult> {
    this.entries.delete(metadata.secretType);
    return this.fetchFromGsm(metadata);
  }

  setBreakGlass(secretType: string, plaintextValue: string, ttlMs: number): CachedSecret {
    const now = Date.now();
    const entry: CachedSecret = {
      value: plaintextValue,
      version: 'break-glass',
      source: 'break_glass',
      fetchedAt: now,
      expiresAt: now + ttlMs,
    };
    this.setEntry(secretType, entry);
    return entry;
  }

  clearBreakGlass(secretType: string) {
    const existing = this.entries.get(secretType);
    if (existing && existing.source === 'break_glass') {
      this.entries.delete(secretType);
    }
  }

  markEmpty(secretType: string) {
    this.entries.delete(secretType);
    const now = Date.now();
    this.setEntry(secretType, {
      value: '',
      version: '',
      source: 'empty',
      fetchedAt: now,
      expiresAt: Date.now(),
    });
  }
}
