import { readFile } from 'node:fs/promises';
import path from 'node:path';

type LatencyDataset = Record<string, number[]>;

const BUDGETS_P95_MS: Record<string, number> = {
  'api.trade.preview': 350,
  'api.trade.history': 400,
  'mobile.trade-calculator.render': 120,
};

const fixturePath = path.resolve(__dirname, 'fixtures/latency-baseline.json');

let cachedDataset: LatencyDataset | null = null;

const loadDataset = async (): Promise<LatencyDataset | null> => {
  if (cachedDataset) {
    return cachedDataset;
  }

  const explicitPath = process.env.APEX_LATENCY_SAMPLE_PATH;
  const candidatePaths = explicitPath ? [explicitPath, fixturePath] : [fixturePath];

  for (const candidate of candidatePaths) {
    try {
      const absolutePath = path.isAbsolute(candidate)
        ? candidate
        : path.join(process.cwd(), candidate);

      const raw = await readFile(absolutePath, 'utf-8');
      cachedDataset = JSON.parse(raw) as LatencyDataset;
      return cachedDataset;
    } catch {
      // Continue trying fallbacks
    }
  }

  return null;
};

const calculatePercentile = (samples: number[], percentile: number): number => {
  if (samples.length === 0) {
    throw new Error('Cannot compute percentile for an empty sample set');
  }

  const ordered = [...samples].sort((a, b) => a - b);
  const rawIndex = percentile * ordered.length;
  const index = Math.max(Math.ceil(rawIndex) - 1, 0);

  return ordered[index];
};

describe('Performance budgets (p95 latency)', () => {
  const expectation = async (key: keyof typeof BUDGETS_P95_MS) => {
    const dataset = await loadDataset();

    if (!dataset) {
      pending(
        `No latency samples available. Capture metrics and set APEX_LATENCY_SAMPLE_PATH or provide ${fixturePath}.`,
      );
      return;
    }

    const samples = dataset[key] ?? [];

    if (samples.length === 0) {
      pending(`Latency dataset missing series for ${key}.`);
      return;
    }

    expect.hasAssertions();

    const percentile = calculatePercentile(samples, 0.95);
    expect(percentile).toBeLessThanOrEqual(BUDGETS_P95_MS[key]);
  };

  test('trade preview API responds within 350ms p95', async () => {
    await expectation('api.trade.preview');
  });

  test('trade history API responds within 400ms p95', async () => {
    await expectation('api.trade.history');
  });

  test('trade calculator render cycle stays within 120ms p95', async () => {
    await expectation('mobile.trade-calculator.render');
  });
});
