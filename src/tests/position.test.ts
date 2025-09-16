import { calcPositionSize } from '@/lib/position';

test('size calculation', () => {
  const { size } = calcPositionSize({
    equity: 10000,
    riskPct: 0.01,
    entry: 50000,
    stop: 49000,
  });
  // riskAmount = 100; riskPerUnit = 1000; size=0.1
  expect(size).toBeCloseTo(0.1);
});

