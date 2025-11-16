import { Registry } from 'prom-client';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

export interface MetricLabels {
  [key: string]: string | number | boolean | undefined;
}

interface CounterStore {
  [labelKey: string]: number;
}

interface HistogramStore {
  values: number[];
  maxSize: number;
}

export interface Observability {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  recordLatency(name: string, valueMs: number, labels?: MetricLabels): void;
  recordAvailability(up: boolean, labels?: MetricLabels): void;
  snapshot(): ObservabilitySnapshot;
}

export interface ObservabilitySnapshot {
  counters: Record<
    string,
    Array<{
      labels: MetricLabels;
      value: number;
    }>
  >;
  histograms: Record<
    string,
    {
      count: number;
      p50: number | null;
      p95: number | null;
      p99: number | null;
    }
  >;
}

declare module 'fastify' {
  interface FastifyInstance {
    observability: Observability;
    metricsRegistry: Registry;
  }

  interface FastifyRequest {
    metricsStartTime?: bigint;
  }
}

const serializeLabels = (labels: MetricLabels | undefined): string => {
  if (!labels) {
    return '{}';
  }
  const entries = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
};

const parseLabels = (labelKey: string): MetricLabels => {
  const rawEntries = JSON.parse(labelKey) as [string, unknown][];
  const parsed: MetricLabels = {};
  for (const [key, rawValue] of rawEntries) {
    if (
      typeof rawValue === 'string' ||
      typeof rawValue === 'number' ||
      typeof rawValue === 'boolean' ||
      rawValue === undefined
    ) {
      parsed[key] = rawValue;
    } else if (rawValue == null) {
      parsed[key] = undefined;
    } else {
      parsed[key] = String(rawValue);
    }
  }
  return parsed;
};

const resolveRouteId = (request: FastifyRequest): string => {
  const routeOptions = (request as { routeOptions?: { url?: string } }).routeOptions;
  if (routeOptions?.url) {
    return routeOptions.url;
  }

  const routerPath = (request as { routerPath?: string }).routerPath;
  if (routerPath) {
    return routerPath;
  }

  return request.url;
};

const ensureHistogram = (store: Map<string, HistogramStore>, key: string, size: number) => {
  let histogram = store.get(key);
  if (!histogram) {
    histogram = {
      values: [],
      maxSize: size,
    };
    store.set(key, histogram);
  }
  return histogram;
};

const percentile = (values: number[], percentileValue: number): number | null => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((percentileValue / 100) * sorted.length));
  return sorted[index] ?? null;
};

const createObservability = (histogramSize = 512): Observability => {
  const counters = new Map<string, CounterStore>();
  const histograms = new Map<string, HistogramStore>();

  return {
    incrementCounter(name, labels = {}, value = 1) {
      const labelKey = serializeLabels(labels);
      const bucket = counters.get(name) ?? {};
      bucket[labelKey] = (bucket[labelKey] ?? 0) + value;
      counters.set(name, bucket);
    },
    recordLatency(name, valueMs, labels = {}) {
      const labelKey = serializeLabels(labels);
      const histogram = ensureHistogram(histograms, `${name}:${labelKey}`, histogramSize);
      histogram.values.push(valueMs);
      if (histogram.values.length > histogram.maxSize) {
        histogram.values.shift();
      }
    },
    recordAvailability(up, labels = {}) {
      const statusLabels = {
        ...labels,
        status: up ? 'up' : 'down',
      };
      const labelKey = serializeLabels(statusLabels);
      const bucket = counters.get('uptime_checks_total') ?? {};
      bucket[labelKey] = (bucket[labelKey] ?? 0) + 1;
      counters.set('uptime_checks_total', bucket);

      if (!up) {
        const outageBucket = counters.get('uptime_outages_total') ?? {};
        outageBucket[labelKey] = (outageBucket[labelKey] ?? 0) + 1;
        counters.set('uptime_outages_total', outageBucket);
      }
    },
    snapshot() {
      const counterSnapshot: ObservabilitySnapshot['counters'] = {};
      for (const [name, store] of counters.entries()) {
        counterSnapshot[name] = Object.entries(store).map(([labelKey, value]) => ({
          labels: parseLabels(labelKey),
          value,
        }));
      }

      const histogramSnapshot: ObservabilitySnapshot['histograms'] = {};
      for (const [key, store] of histograms.entries()) {
        histogramSnapshot[key] = {
          count: store.values.length,
          p50: percentile(store.values, 50),
          p95: percentile(store.values, 95),
          p99: percentile(store.values, 99),
        };
      }

      return {
        counters: counterSnapshot,
        histograms: histogramSnapshot,
      };
    },
  };
};

const hrtimeDiffMs = (start: bigint, end: bigint): number => {
  return Number(end - start) / 1_000_000;
};

const recordRequestMetrics = (
  request: FastifyRequest,
  reply: FastifyReply,
  observability: Observability,
) => {
  const route = resolveRouteId(request);
  const method = request.method;
  const statusCode = reply.statusCode;

  observability.incrementCounter('http_requests_total', {
    route,
    method,
    statusCode,
  });

  observability.recordAvailability(statusCode < 500, {
    route,
    method,
  });

  if (statusCode >= 500) {
    observability.incrementCounter('http_errors_total', {
      route,
      method,
    });
  }

  if (
    method === 'POST' &&
    (route === '/v1/trades/preview' || route?.endsWith('/v1/trades/preview'))
  ) {
    observability.incrementCounter('trade_preview_requests_total', {
      route,
    });
  }
};

export interface ObservabilityPluginOptions {
  histogramSize?: number;
}

export const observabilityPlugin: FastifyPluginAsync<ObservabilityPluginOptions> = async (
  app,
  { histogramSize = 512 } = {},
) => {
  const observability = createObservability(histogramSize);
  app.decorate('observability', observability);
  const metricsRegistry = new Registry();
  app.decorate('metricsRegistry', metricsRegistry);

  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return reply.send(await metricsRegistry.metrics());
  });

  const handleUncaughtException = (error: unknown) => {
    app.log.error({ err: error }, 'process.uncaught_exception');
    observability.incrementCounter('process_uncaught_exceptions_total');
  };

  const handleUnhandledRejection = (reason: unknown) => {
    app.log.error({ err: reason }, 'process.unhandled_rejection');
    observability.incrementCounter('process_unhandled_rejections_total');
  };

  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);

  app.addHook('onClose', (_instance, done) => {
    process.off('uncaughtException', handleUncaughtException);
    process.off('unhandledRejection', handleUnhandledRejection);
    done();
  });

  app.addHook('onRequest', async (request) => {
    request.metricsStartTime = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    if (!request.metricsStartTime) {
      return;
    }
    const durationMs = hrtimeDiffMs(request.metricsStartTime, process.hrtime.bigint());
    const route = resolveRouteId(request);
    observability.recordLatency('http_request_duration_ms', durationMs, {
      route,
      method: request.method,
    });
    recordRequestMetrics(request, reply, observability);
    app.log.info(
      {
        route,
        method: request.method,
        statusCode: reply.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
      },
      'http.request.completed',
    );
  });

  app.addHook('onError', async (request, reply, error) => {
    observability.incrementCounter('http_errors_total', {
      route: resolveRouteId(request),
      method: request.method,
      statusCode: reply.statusCode,
    });
    app.log.error({ err: error }, 'http.request.error');
  });
};

export default observabilityPlugin;
