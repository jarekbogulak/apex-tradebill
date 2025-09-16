// Central place to tweak trade-bill assumptions and mapping.

export type TradeBillInputs = {
  symbol: string;         // public ticker symbol (no dash), e.g. BTCUSDT
  symbolDash: string;     // trading symbol (dash), e.g. BTC-USDT
  accountEquity: number;  // quote currency (e.g., USDT)
  riskPct: number;        // 0.0 - 1.0 (e.g. 0.01)
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;    // display only
  side: 'BUY' | 'SELL';
  leverage: number;       // display only
};

export type TradeBillOutputs = {
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  size: number;           // base-asset units to trade (e.g., BTC)
};

// Position sizing assumptions (perps/futures-style)
// riskAmount = AccountEquity * RiskPct
// riskPerUnit = |EntryPrice - StopPrice|
// size = riskAmount / riskPerUnit
export function computeSize(input: TradeBillInputs): TradeBillOutputs {
  const riskAmount = input.accountEquity * input.riskPct;
  const riskPerUnit = Math.abs(input.entryPrice - input.stopPrice);
  const size = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  return {
    entryPrice: input.entryPrice,
    stopPrice: input.stopPrice,
    targetPrice: input.targetPrice,
    size,
  };
}

