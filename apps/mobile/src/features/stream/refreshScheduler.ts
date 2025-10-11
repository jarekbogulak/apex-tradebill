export interface RefreshSchedulerTelemetry {
  onTick?: (timestamp: number) => void;
  onLagDetected?: (lagMs: number) => void;
}

export interface RefreshSchedulerOptions {
  intervalMs?: number;
  jitterMs?: number;
  telemetry?: RefreshSchedulerTelemetry;
}

export interface RefreshScheduler {
  start(): void;
  stop(): void;
  recordHeartbeat(): void;
  isRunning(): boolean;
}

const DEFAULT_INTERVAL_MS = 1000;

export const createRefreshScheduler = ({
  intervalMs = DEFAULT_INTERVAL_MS,
  jitterMs = 50,
  telemetry,
}: RefreshSchedulerOptions = {}): RefreshScheduler => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastTick = 0;
  let running = false;

  const scheduleNext = () => {
    const delay = intervalMs + Math.random() * jitterMs;
    timer = setTimeout(() => {
      const now = Date.now();
      const delta = now - lastTick;

      if (lastTick && delta > intervalMs * 1.5) {
        telemetry?.onLagDetected?.(delta);
      }

      lastTick = now;
      telemetry?.onTick?.(now);
      scheduleNext();
    }, delay);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      lastTick = Date.now();
      scheduleNext();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    recordHeartbeat() {
      lastTick = Date.now();
    },
    isRunning() {
      return running;
    },
  };
};
