import { create } from 'zustand';

type TradeState = {
  symbol: string;
  symbolDash: string;
  equity: string;
  riskPct: string;
  entry: string;
  stop: string;
  target: string;
  side: 'BUY'|'SELL';
  leverage: string;
  set: (p: Partial<TradeState>) => void;
};

export const useTradeStore = create<TradeState>((set) => ({
  symbol: 'BTCUSDT',
  symbolDash: 'BTC-USDT',
  equity: '10000',
  riskPct: '0.01',
  entry: '',
  stop: '',
  target: '',
  side: 'BUY',
  leverage: '1',
  set: (p) => set(p),
}));

