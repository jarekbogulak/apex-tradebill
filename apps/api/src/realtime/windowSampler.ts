export interface PriceTick {
  timestamp: number;
  price: number;
}

export interface SampledTick {
  windowStart: number;
  windowEnd: number;
  tick: PriceTick;
  carried: boolean;
}

const sortTicks = (ticks: PriceTick[]): PriceTick[] => {
  return [...ticks].sort((a, b) => a.timestamp - b.timestamp);
};

export interface SamplingOptions {
  carryForward?: boolean;
}

export const sampleLatestPerWindow = (
  ticks: PriceTick[],
  windowMs: number,
  { carryForward = true }: SamplingOptions = {},
): SampledTick[] => {
  if (windowMs <= 0) {
    throw new Error('windowMs must be greater than zero');
  }

  const ordered = sortTicks(ticks);
  if (ordered.length === 0) {
    return [];
  }

  const windows = new Map<number, PriceTick>();
  for (const tick of ordered) {
    const windowStart = Math.floor(tick.timestamp / windowMs) * windowMs;
    const existing = windows.get(windowStart);
    if (!existing || existing.timestamp <= tick.timestamp) {
      windows.set(windowStart, tick);
    }
  }

  const firstWindow = Math.floor(ordered[0].timestamp / windowMs) * windowMs;
  const lastWindow = Math.floor(ordered[ordered.length - 1].timestamp / windowMs) * windowMs;

  const samples: SampledTick[] = [];
  let previousTick: PriceTick | null = null;

  for (let start = firstWindow; start <= lastWindow; start += windowMs) {
    const tick = windows.get(start);
    if (tick) {
      samples.push({
        windowStart: start,
        windowEnd: start + windowMs,
        tick,
        carried: false,
      });
      previousTick = tick;
    } else if (carryForward && previousTick) {
      samples.push({
        windowStart: start,
        windowEnd: start + windowMs,
        tick: previousTick,
        carried: true,
      });
    }
  }

  return samples;
};
