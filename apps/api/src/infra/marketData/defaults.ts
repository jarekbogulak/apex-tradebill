import type { Symbol as TradingSymbol } from '@apex-tradebill/types';

export const DEFAULT_BASE_PRICES: Record<TradingSymbol, number> = {
  'BTC-USDT': 65_000,
  'ETH-USDT': 3_200,
};
