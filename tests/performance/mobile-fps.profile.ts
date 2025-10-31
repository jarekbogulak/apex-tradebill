import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface FpsTrace {
  flow: string;
  capturedAt: string;
  device: string;
  frameDurationsMs: number[];
  notes?: string;
}

const TARGET_FLOW = 'trade-calculator';
const REQUIRED_PERCENTILE = 0.95;
const MINIMUM_FPS = 55;
const FRAME_DURATION_BUDGET_MS = 1000 / MINIMUM_FPS;

const fallbackTracePath = path.resolve(__dirname, 'fixtures/trade-calculator-fps.json');

const resolveTracePath = (): string => {
  const explicit = process.env.APEX_FPS_TRACE_PATH;

  if (!explicit) {
    return fallbackTracePath;
  }

  return path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit);
};

const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) {
    throw new Error('Cannot compute percentile for an empty sample set');
  }

  const ordered = [...values].sort((a, b) => a - b);
  const rawIndex = percentile * ordered.length;
  const index = Math.max(Math.ceil(rawIndex) - 1, 0);

  return ordered[index];
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const renderReport = async (): Promise<number> => {
  const tracePath = resolveTracePath();
  const buffer = await readFile(tracePath, 'utf-8');
  const trace = JSON.parse(buffer) as FpsTrace;

  if (!trace.frameDurationsMs || !Array.isArray(trace.frameDurationsMs)) {
    throw new Error(`Trace at ${tracePath} does not contain frameDurationsMs samples`);
  }

  if (trace.flow !== TARGET_FLOW) {
    throw new Error(`Trace flow ${trace.flow} does not match expected ${TARGET_FLOW}`);
  }

  const { frameDurationsMs } = trace;
  const percentileDuration = calculatePercentile(frameDurationsMs, REQUIRED_PERCENTILE);
  const percentileFps = 1000 / percentileDuration;
  const withinBudget = percentileDuration <= FRAME_DURATION_BUDGET_MS;
  const framesWithinBudget =
    frameDurationsMs.filter((duration) => duration <= FRAME_DURATION_BUDGET_MS).length /
    frameDurationsMs.length;

  console.log('--- Expo FPS Profiling Report ---');
  console.log(`Trace path: ${tracePath}`);
  console.log(`Flow: ${trace.flow}`);
  console.log(`Captured at: ${trace.capturedAt}`);
  console.log(`Device: ${trace.device}`);
  if (trace.notes) {
    console.log(`Notes: ${trace.notes}`);
  }
  console.log(`Samples: ${frameDurationsMs.length}`);
  console.log(`p95 frame duration: ${percentileDuration.toFixed(2)} ms`);
  console.log(`p95 effective FPS: ${percentileFps.toFixed(2)}`);
  console.log(
    `Frames within ${FRAME_DURATION_BUDGET_MS.toFixed(2)} ms budget: ${formatPercent(
      framesWithinBudget,
    )}`,
  );
  console.log(`Compliance (>= ${MINIMUM_FPS} FPS @ p95): ${withinBudget ? 'PASS' : 'FAIL'}`);

  return withinBudget ? 0 : 1;
};

renderReport()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error('[mobile-fps.profile] Failed to evaluate FPS trace:', error);
    process.exitCode = 1;
  });
