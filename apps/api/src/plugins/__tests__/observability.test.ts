import fastify from 'fastify';
import { observabilityPlugin } from '../observability.js';

describe('observabilityPlugin', () => {
  it('records request metrics and latency histograms', async () => {
    const app = fastify({ logger: false });
    await observabilityPlugin(app, { histogramSize: 16 });

    app.get('/ping', async () => ({ ok: true }));
    app.get('/error', async () => {
      throw new Error('boom');
    });

    await app.ready();

    const okResponse = await app.inject({ method: 'GET', url: '/ping' });
    expect(okResponse.statusCode).toBe(200);

    const errorResponse = await app.inject({ method: 'GET', url: '/error' });
    expect(errorResponse.statusCode).toBe(500);

    const observability = app.observability;
    expect(observability).toBeDefined();

    const snapshot = observability.snapshot();

    const httpRequests = snapshot.counters['http_requests_total'];
    expect(httpRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            route: '/ping',
            method: 'GET',
            statusCode: 200,
          }),
          value: 1,
        }),
        expect.objectContaining({
          labels: expect.objectContaining({
            route: '/error',
            method: 'GET',
            statusCode: 500,
          }),
          value: 1,
        }),
      ]),
    );

    const httpErrors = snapshot.counters['http_errors_total'];
    expect(httpErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            route: '/error',
            method: 'GET',
          }),
          value: 1,
        }),
      ]),
    );

    const uptimeCounters = snapshot.counters['uptime_checks_total'];
    expect(uptimeCounters).toHaveLength(2);

    const durationHistograms = Object.values(snapshot.histograms);
    expect(durationHistograms.some((hist) => hist.count > 0)).toBe(true);

    await app.close();
  });

  it('increments observability counters for process-level failures', async () => {
    const baseUncaught = process.listeners('uncaughtException').length;
    const baseUnhandled = process.listeners('unhandledRejection').length;

    const app = fastify({ logger: false });
    await observabilityPlugin(app);
    await app.ready();

    expect(process.listeners('uncaughtException')).toHaveLength(baseUncaught + 1);
    expect(process.listeners('unhandledRejection')).toHaveLength(baseUnhandled + 1);

    process.emit('uncaughtException', new Error('uncaught failure'));
    process.emit('unhandledRejection', new Error('rejection'), Promise.resolve());

    const observability = app.observability;
    expect(observability).toBeDefined();

    const snapshot = observability.snapshot();

    expect(snapshot.counters['process_uncaught_exceptions_total']).toEqual([
      expect.objectContaining({ value: 1 }),
    ]);
    expect(snapshot.counters['process_unhandled_rejections_total']).toEqual([
      expect.objectContaining({ value: 1 }),
    ]);

    await app.close();

    expect(process.listeners('uncaughtException')).toHaveLength(baseUncaught);
    expect(process.listeners('unhandledRejection')).toHaveLength(baseUnhandled);
  });
});
