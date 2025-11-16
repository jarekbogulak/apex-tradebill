interface AlertLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

export interface OmniSecretsAlerts {
  recordCacheFailure(secretType: string, reason: string): void;
  resetFailure(secretType: string): void;
  recordBreakGlass(secretType: string, expiresAt: string): void;
}

export const createOmniSecretsAlerts = (logger: AlertLogger, threshold = 3): OmniSecretsAlerts => {
  const failureCounts = new Map<string, number>();

  return {
    recordCacheFailure(secretType, reason) {
      const nextCount = (failureCounts.get(secretType) ?? 0) + 1;
      failureCounts.set(secretType, nextCount);
      logger.warn('omni.alert.cache_failure', {
        secretType,
        reason,
        consecutiveFailures: nextCount,
      });
      if (nextCount >= threshold) {
        logger.warn('omni.alert.cache_failure.threshold', {
          secretType,
          reason,
          consecutiveFailures: nextCount,
        });
      }
    },
    resetFailure(secretType) {
      failureCounts.delete(secretType);
    },
    recordBreakGlass(secretType, expiresAt) {
      logger.warn('omni.alert.break_glass_applied', {
        secretType,
        expiresAt,
      });
    },
  };
};
