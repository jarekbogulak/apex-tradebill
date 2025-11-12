export interface SchedulerTelemetry {
  onTick?: (timestamp: number) => void;
  onLagDetected?: (lagMs: number) => void;
}

export interface SchedulerOptions {
  intervalMs?: number;
  telemetry?: SchedulerTelemetry;
}

export interface RefreshScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

const DEFAULT_INTERVAL_MS = 1000;

export const createRefreshScheduler = ({
  intervalMs = DEFAULT_INTERVAL_MS,
  telemetry,
}: SchedulerOptions = {}): RefreshScheduler => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTick = 0;
  let running = false;

  const handleTick = () => {
    const now = Date.now();
    const delta = now - lastTick;

    if (lastTick && delta > intervalMs * 1.5) {
      telemetry?.onLagDetected?.(delta);
    }

    lastTick = now;
    telemetry?.onTick?.(now);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      lastTick = Date.now();
      timer = setInterval(handleTick, intervalMs);
    },
    stop() {
      if (!running) {
        return;
      }
      running = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    isRunning() {
      return running;
    },
  };
};
