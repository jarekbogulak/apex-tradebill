export type Side = 'BUY' | 'SELL';

export function calcPositionSize(params: {
  equity: number;    // Account equity in quote (e.g., USDT)
  riskPct: number;   // 0.0 - 1.0 (e.g., 0.01 for 1%)
  entry: number;
  stop: number;
}) {
  const riskAmount = params.equity * params.riskPct;
  const perUnit = Math.abs(params.entry - params.stop);
  if (perUnit <= 0) return { size: 0, riskAmount, perUnit };
  const size = riskAmount / perUnit; // base units (e.g., BTC)
  return { size, riskAmount, perUnit };
}

