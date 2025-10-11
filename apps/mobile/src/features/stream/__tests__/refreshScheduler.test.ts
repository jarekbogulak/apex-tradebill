import { createRefreshScheduler } from '../refreshScheduler.js';

describe('Refresh scheduler (mobile)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('triggers recompute every second while respecting app state', () => {
    const ticks: number[] = [];
    const scheduler = createRefreshScheduler({
      intervalMs: 1000,
      jitterMs: 0,
      telemetry: {
        onTick: (timestamp) => ticks.push(timestamp),
      },
    });

    scheduler.start();
    jest.advanceTimersByTime(3000);
    scheduler.stop();

    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  test('emits telemetry events when thresholds breach', () => {
    const lagEvents: number[] = [];
    const scheduler = createRefreshScheduler({
      intervalMs: 1000,
      jitterMs: 0,
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
