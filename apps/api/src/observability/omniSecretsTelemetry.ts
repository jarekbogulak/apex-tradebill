import { Counter, Gauge } from 'prom-client';
import type { Registry } from 'prom-client';
import type { CacheSource } from '@api/modules/omniSecrets/types.js';

export interface OmniSecretsTelemetry {
  recordSecretRead(secretType: string, source: CacheSource | 'break_glass', durationMs?: number): void;
  recordSecretFailure(secretType: string, reason: string): void;
  setCacheAge(secretType: string, source: CacheSource | 'break_glass', ageSeconds: number | null): void;
  registry: Registry;
}

export const createOmniSecretsTelemetry = (registry: Registry): OmniSecretsTelemetry => {
  const secretReads = new Counter({
    name: 'omni_secret_reads_total',
    help: 'Total number of Apex Omni secret reads grouped by secret type and source.',
    labelNames: ['secret_type', 'source'],
    registers: [registry],
  });

  const secretFailures = new Counter({
    name: 'omni_secret_failures_total',
    help: 'Total number of failed secret retrieval attempts grouped by secret type and reason.',
    labelNames: ['secret_type', 'reason'],
    registers: [registry],
  });

  const cacheAgeGauge = new Gauge({
    name: 'omni_secret_cache_age_seconds',
    help: 'Age of the cached secret material in seconds.',
    labelNames: ['secret_type', 'source'],
    registers: [registry],
  });

  return {
    recordSecretRead(secretType, source, _durationMs) {
      secretReads.inc({ secret_type: secretType, source }, 1);
    },
    recordSecretFailure(secretType, reason) {
      secretFailures.inc({ secret_type: secretType, reason });
    },
    setCacheAge(secretType, source, ageSeconds) {
      if (ageSeconds == null) {
        return;
      }
      cacheAgeGauge.set({ secret_type: secretType, source }, ageSeconds);
    },
    registry,
  };
};
