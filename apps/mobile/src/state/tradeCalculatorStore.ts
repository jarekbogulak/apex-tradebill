import type {
  TradeOutput,
  TradeWarningCode,
  Direction,
  Timeframe,
  MarketSnapshot,
  Symbol,
} from '@apex-tradebill/types';
import { create } from 'zustand';

export type TradeCalculatorStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TradeCalculatorInputState {
  symbol: Symbol;
  direction: Direction;
  accountSize: string;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string;
  riskPercent: string;
  atrMultiplier: string;
  useVolatilityStop: boolean;
  timeframe: Timeframe;
  accountEquitySource: 'connected' | 'manual';
}

export interface TradeCalculatorState {
  input: TradeCalculatorInputState;
  output: TradeOutput | null;
  snapshot: MarketSnapshot | null;
  warnings: TradeWarningCode[];
  status: TradeCalculatorStatus;
  error: string | null;
  lastUpdatedAt: string | null;
  hasManualEntry: boolean;
  setSymbol: (symbol: Symbol) => void;
  setInput: (patch: Partial<TradeCalculatorInputState>) => void;
  setOutput: (
    output: TradeOutput,
    snapshot: MarketSnapshot,
    warnings: TradeWarningCode[],
    timestamp: string,
  ) => void;
  setStatus: (status: TradeCalculatorStatus, error?: string | null) => void;
  setHasManualEntry: (hasManualEntry: boolean) => void;
  reset: () => void;
}

const INITIAL_INPUT: TradeCalculatorInputState = {
  symbol: 'BTC-USDT' as Symbol,
  direction: 'long',
  accountSize: '0.00',
  entryPrice: null,
  stopPrice: null,
  targetPrice: '0.00',
  riskPercent: '0.02',
  atrMultiplier: '1.50',
  useVolatilityStop: true,
  timeframe: '15m',
  accountEquitySource: 'connected',
};

export const useTradeCalculatorStore = create<TradeCalculatorState>((set) => ({
  input: INITIAL_INPUT,
  output: null,
  snapshot: null,
  warnings: [],
  status: 'idle',
  error: null,
  lastUpdatedAt: null,
  hasManualEntry: false,
  setSymbol: (symbol) => {
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        symbol,
        entryPrice: null,
        stopPrice: null,
        targetPrice: '0.00',
      },
      output: null,
      snapshot: null,
      warnings: [],
      status: 'idle',
      error: null,
      lastUpdatedAt: null,
      hasManualEntry: false,
    }));
  },
  setInput: (patch) => {
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        ...patch,
      },
    }));
  },
  setOutput: (output, snapshot, warnings, timestamp) => {
    set((state) => ({
      ...state,
      output,
      snapshot,
      warnings,
      status: 'success',
      error: null,
      lastUpdatedAt: timestamp,
    }));
  },
  setStatus: (status, error = null) => {
    set((state) => ({
      ...state,
      status,
      error,
    }));
  },
  setHasManualEntry: (hasManualEntry) => {
    set((state) => ({
      ...state,
      hasManualEntry,
    }));
  },
  reset: () => {
    set({
      input: INITIAL_INPUT,
      output: null,
      snapshot: null,
      warnings: [],
      status: 'idle',
      error: null,
      lastUpdatedAt: null,
      hasManualEntry: false,
    });
  },
}));

export const selectCalculatorInput = (state: TradeCalculatorState) => state.input;
export const selectCalculatorStatus = (state: TradeCalculatorState) => state.status;
export const selectCalculatorOutput = (state: TradeCalculatorState) => ({
  output: state.output,
  warnings: state.warnings,
  lastUpdatedAt: state.lastUpdatedAt,
  snapshot: state.snapshot,
});
