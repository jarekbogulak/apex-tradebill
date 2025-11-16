import type { OmniSecretService } from '@api/modules/omniSecrets/service.js';
import type { DatabasePool } from '../adapters/persistence/providers/postgres/pool.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export interface RotationMonitorOptions {
  service: OmniSecretService;
  logger?: {
    warn(message: string, context?: Record<string, unknown>): void;
  };
}

export interface RotationMonitorHandle {
  stop(): void;
}

export const scheduleOmniRotationMonitor = ({
  service,
  logger,
}: RotationMonitorOptions): RotationMonitorHandle => {
  const log = logger ?? {
    warn: () => {},
  };

  const check = async () => {
    const metadata = await service.listMetadata();
    const now = Date.now();
    for (const entry of metadata) {
      if (!entry.rotationDueAt) {
        continue;
      }
      const rotationDueMs = new Date(entry.rotationDueAt).getTime();
      if (Number.isNaN(rotationDueMs)) {
        continue;
      }
      if (rotationDueMs < now) {
        log.warn('omni.rotation_overdue', {
          secretType: entry.secretType,
          rotationDueAt: entry.rotationDueAt,
        });
      }
    }
  };

  const timer = setInterval(() => {
    void check();
  }, CHECK_INTERVAL_MS);

  void check();

  return {
    stop() {
      clearInterval(timer);
    },
  };
};
