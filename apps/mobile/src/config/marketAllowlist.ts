import type { Symbol } from '@apex-tradebill/types';

import allowlistConfig from '../../../../configs/markets/allowlist.json';

type AllowlistConfig = {
  symbols?: string[];
};

const config = allowlistConfig as AllowlistConfig;
const normalizedSymbols = Array.isArray(config.symbols)
  ? (config.symbols.filter((value): value is Symbol => typeof value === 'string') as Symbol[])
  : [];

export const MARKET_ALLOWLIST = Object.freeze([...normalizedSymbols]) as readonly Symbol[];

export const isSymbolAllowlisted = (symbol: string): symbol is Symbol => {
  return normalizedSymbols.includes(symbol as Symbol);
};
