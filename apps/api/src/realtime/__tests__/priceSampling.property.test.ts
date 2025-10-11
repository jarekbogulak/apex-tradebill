import { sampleLatestPerWindow } from '../windowSampler.js';

describe('Price sampling window', () => {
  test('selects latest tick within each sampling window', () => {
    const ticks = [
      { timestamp: 1_000, price: 100 },
      { timestamp: 1_500, price: 101 },
      { timestamp: 1_900, price: 99 },
      { timestamp: 2_100, price: 110 },
      { timestamp: 2_900, price: 120 },
      { timestamp: 3_050, price: 115 },
    ];

    const samples = sampleLatestPerWindow(ticks, 1_000, { carryForward: false });
    const pricesByWindow = samples.map((sample) => sample.tick.price);

    expect(samples).toHaveLength(3);
    expect(pricesByWindow[0]).toBe(99);
    expect(pricesByWindow[1]).toBe(120);
    expect(pricesByWindow[2]).toBe(115);
    expect(samples.every((sample) => sample.carried === false)).toBe(true);
  });

  test('carries last tick forward during idle intervals', () => {
    const ticks = [
      { timestamp: 1_000, price: 100 },
      { timestamp: 3_100, price: 105 },
    ];

    const samples = sampleLatestPerWindow(ticks, 1_000, { carryForward: true });

    expect(samples).toHaveLength(3);
    expect(samples[0].tick.price).toBe(100);
    expect(samples[0].carried).toBe(false);
    expect(samples[1].tick.price).toBe(100);
    expect(samples[1].carried).toBe(true);
    expect(samples[2].tick.price).toBe(105);
    expect(samples[2].carried).toBe(false);
  });
});
