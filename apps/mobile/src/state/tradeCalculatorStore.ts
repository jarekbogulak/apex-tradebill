import type { TradeOutput, TradeWarningCode, Direction, Timeframe } from '@apex-tradebill/types';
import { create } from 'zustand';

export type TradeCalculatorStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TradeCalculatorInputState {
  symbol: string;
  direction: Direction;
  accountSize: string;
  entryPrice: string | null;
  stopPrice: string;
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
  warnings: TradeWarningCode[];
  status: TradeCalculatorStatus;
  error: string | null;
  lastUpdatedAt: string | null;
  setInput: (patch: Partial<TradeCalculatorInputState>) => void;
  setOutput: (output: TradeOutput, warnings: TradeWarningCode[], timestamp: string) => void;
  setStatus: (status: TradeCalculatorStatus, error?: string | null) => void;
  reset: () => void;
}

const INITIAL_INPUT: TradeCalculatorInputState = {
  symbol: 'BTC-USDT',
  direction: 'long',
  accountSize: '0.00',
  entryPrice: null,
  stopPrice: '0.00',
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
  warnings: [],
  status: 'idle',
  error: null,
  lastUpdatedAt: null,
  setInput: (patch) => {
    set((state) => ({
      ...state,
      input: {
        ...state.input,
        ...patch,
      },
    }));
  },
  setOutput: (output, warnings, timestamp) => {
    set((state) => ({
      ...state,
      output,
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
  reset: () => {
    set({
      input: INITIAL_INPUT,
      output: null,
      warnings: [],
      status: 'idle',
      error: null,
      lastUpdatedAt: null,
    });
  },
}));

export const selectCalculatorInput = (state: TradeCalculatorState) => state.input;
export const selectCalculatorStatus = (state: TradeCalculatorState) => state.status;
export const selectCalculatorOutput = (state: TradeCalculatorState) => ({
  output: state.output,
  warnings: state.warnings,
  lastUpdatedAt: state.lastUpdatedAt,
});
