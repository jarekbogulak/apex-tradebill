import type {
  MarketSnapshot,
  Symbol,
  Timeframe,
  TradeInput,
  TradeOutput,
} from '@apex-tradebill/types';
import type { ConnectedAccount } from '../connected-account/connected-account.entity.js';
import type { UserSettings } from '../user-settings/user-settings.entity.js';

export interface MarketCandle {
  timestamp: string;
  high: number;
  low: number;
  close: number;
}

export interface SymbolMetadata {
  symbol: Symbol;
  tickSize: string;
  stepSize: string;
  minNotional: string;
  minQuantity: string;
  status: 'tradable' | 'suspended';
  displayName?: string;
}

export interface MarketDataPort {
  getLatestSnapshot(symbol: Symbol): Promise<MarketSnapshot | null>;
  getRecentCandles(
    symbol: Symbol,
    timeframe: Timeframe,
    lookback: number,
  ): Promise<MarketCandle[]>;
}

export interface MarketMetadataPort {
  getMetadata(symbol: Symbol): Promise<SymbolMetadata | null>;
  listAllowlistedSymbols(): Promise<Symbol[]>;
}

export interface EquitySnapshot {
  source: 'connected' | 'manual';
  equity: string;
  lastSyncedAt: string;
  connectedAccount?: ConnectedAccount | null;
}

export interface AccountEquityPort {
  getEquity(userId: string): Promise<EquitySnapshot | null>;
  setManualEquity(userId: string, equity: string): Promise<EquitySnapshot>;
}

export interface SettingsPort {
  getSettings(userId: string): Promise<UserSettings | null>;
  saveSettings(settings: UserSettings): Promise<UserSettings>;
}

export interface TradeRecorderPort {
  recordCalculation(
    userId: string,
    input: TradeInput,
    output: TradeOutput,
    snapshot: MarketSnapshot,
  ): Promise<void>;
}
