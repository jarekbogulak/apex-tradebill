import type { OmniSecretAccessEvent, OmniSecretMetadata } from './types.js';
import { OmniSecretMetadataSchema } from './types.js';
import type { OmniSecretRepository, OmniSecretMetadataUpdates } from './repository.js';

const buildSeedCatalog = (): OmniSecretMetadata[] => {
  const now = new Date().toISOString();
  return [
    {
      secretType: 'trading_api_key',
      environment: 'production',
      gcpSecretId: 'projects/local-dev/secrets/apex-omni-trading-api-key',
      gcpVersionAlias: 'latest',
      status: 'active',
      rotationDueAt: now,
      lastRotatedAt: null,
      lastValidatedAt: null,
      owner: 'Security Engineering',
      breakGlassEnabledUntil: null,
      cacheSource: 'gsm',
      cacheVersion: 'latest',
      createdAt: now,
      updatedAt: now,
    },
    {
      secretType: 'trading_client_secret',
      environment: 'production',
      gcpSecretId: 'projects/local-dev/secrets/apex-omni-trading-client-secret',
      gcpVersionAlias: 'latest',
      status: 'active',
      rotationDueAt: now,
      lastRotatedAt: null,
      lastValidatedAt: null,
      owner: 'Security Engineering',
      breakGlassEnabledUntil: null,
      cacheSource: 'gsm',
      cacheVersion: 'latest',
      createdAt: now,
      updatedAt: now,
    },
    {
      secretType: 'webhook_shared_secret',
      environment: 'production',
      gcpSecretId: 'projects/local-dev/secrets/apex-omni-webhook-shared-secret',
      gcpVersionAlias: 'latest',
      status: 'active',
      rotationDueAt: now,
      lastRotatedAt: null,
      lastValidatedAt: null,
      owner: 'Platform Reliability',
      breakGlassEnabledUntil: null,
      cacheSource: 'gsm',
      cacheVersion: 'latest',
      createdAt: now,
      updatedAt: now,
    },
    {
      secretType: 'zk_signing_seed',
      environment: 'production',
      gcpSecretId: 'projects/local-dev/secrets/apex-omni-zk-signing-seed',
      gcpVersionAlias: 'latest',
      status: 'active',
      rotationDueAt: now,
      lastRotatedAt: null,
      lastValidatedAt: null,
      owner: 'Security Engineering',
      breakGlassEnabledUntil: null,
      cacheSource: 'gsm',
      cacheVersion: 'latest',
      createdAt: now,
      updatedAt: now,
    },
  ];
};

export const createInMemoryOmniSecretRepository = (
  seed: OmniSecretMetadata[] = buildSeedCatalog(),
): OmniSecretRepository => {
  const store = new Map<string, OmniSecretMetadata>();
  for (const entry of seed) {
    store.set(entry.secretType, entry);
  }

  return {
    async listMetadata() {
      return Array.from(store.values());
    },
    async getMetadata(secretType) {
      return store.get(secretType) ?? null;
    },
    async updateMetadata(secretType, updates: OmniSecretMetadataUpdates) {
      const existing = store.get(secretType);
      if (!existing) {
        return;
      }
      const updated: OmniSecretMetadata = OmniSecretMetadataSchema.parse({
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      store.set(secretType, updated);
    },
    async recordAccessEvent(_event: OmniSecretAccessEvent) {
      // no-op in memory
    },
  };
};
