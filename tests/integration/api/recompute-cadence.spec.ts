import { createRefreshScheduler } from '../../../apps/api/src/realtime/refreshScheduler.js';

describe('Recompute cadence telemetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('emits alerts when 1s refresh thresholds are breached', () => {
    const lagEvents: number[] = [];
    const scheduler = createRefreshScheduler({
      intervalMs: 1000,
      telemetry: {
        onLagDetected: (lag) => lagEvents.push(lag),
      },
    });

    scheduler.start();
    jest.advanceTimersByTime(1000);
    jest.setSystemTime(3000);
    jest.advanceTimersByTime(1000);
    scheduler.stop();

    expect(lagEvents[0]).toBeGreaterThanOrEqual(1500);
  });
});
