import type { MarketSnapshot } from '@apex-tradebill/types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';

import {
  selectCalculatorInput,
  selectCalculatorStatus,
  type TradeCalculatorState,
  type TradeCalculatorInputState,
  type TradeCalculatorStatus,
  useTradeCalculatorStore,
} from '@/src/state/tradeCalculatorStore';
import {
  selectFreshnessThreshold,
  selectRiskConfig,
  useSettingsStore,
} from '@/src/state/settingsStore';
import { useAuthStore } from '@/src/state/authStore';

import { useTradeHistory } from './useTradeHistory';
import { useTradeCalculatorFormState } from './useTradeCalculatorFormState';
import { useTradeCalculatorMarketWatcher } from './useTradeCalculatorMarketWatcher';
import { useTradeCalculatorOperations } from './useTradeCalculatorOperations';

export type RiskTone = 'positive' | 'neutral' | 'negative';

interface UseTradeCalculatorControllerResult {
  input: TradeCalculatorInputState;
  status: TradeCalculatorStatus;
  output: TradeCalculatorState['output'];
  snapshot: MarketSnapshot | null;
  warnings: TradeCalculatorState['warnings'];
  lastUpdatedAt: string | null;
  errorMessage: string | null;
  hasOutput: boolean;
  isFormOpen: boolean;
  formMode: 'create' | 'edit';
  isSubmitting: boolean;
  isExecuting: boolean;
  canExecute: boolean;
  marketStream: ReturnType<typeof useTradeCalculatorMarketWatcher>['marketStream'];
  historyItems: ReturnType<typeof useTradeHistory>['items'];
  historyQuery: ReturnType<typeof useTradeHistory>['query'];
  historyError: ReturnType<typeof useTradeHistory>['error'];
  riskSummary: {
    tone: RiskTone;
    riskToReward: number | null;
    riskPercent: string;
  };
  derivedValues: {
    effectiveStop: string | null;
    visualizationStop: string;
    atrValue: string | null;
    marketPlaceholder: string;
  };
  shouldShowErrorBanner: boolean;
  actions: {
    openCreate: () => void;
    openEdit: () => void;
    closeForm: () => void;
    submitForm: () => void;
    execute: () => void;
  };
  fieldHandlers: {
    onAccountSizeChange: (value: string) => void;
    onEntryFocus: () => void;
    onEntryBlur: () => void;
    onEntryPriceChange: (value: string) => void;
    onTargetPriceChange: (value: string) => void;
    onStopPriceChange: (value: string) => void;
    onVolatilityToggle: (value: boolean) => void;
    onDirectionChange: (direction: 'long' | 'short') => void;
  };
}

/**
 * Encapsulates the orchestration logic for the trade calculator screen, including
 * live market data, preview mutations, and form state management.
 */
export const useTradeCalculatorController = (): UseTradeCalculatorControllerResult => {
  const input = useTradeCalculatorStore(selectCalculatorInput);
  const status = useTradeCalculatorStore(selectCalculatorStatus);
  const output = useTradeCalculatorStore((state) => state.output);
  const warnings = useTradeCalculatorStore((state) => state.warnings);
  const snapshot = useTradeCalculatorStore((state) => state.snapshot);
  const errorMessage = useTradeCalculatorStore((state) => state.error);
  const lastUpdatedAt = useTradeCalculatorStore((state) => state.lastUpdatedAt);
  const setInput = useTradeCalculatorStore((state) => state.setInput);
  const setOutput = useTradeCalculatorStore((state) => state.setOutput);
  const setStatus = useTradeCalculatorStore((state) => state.setStatus);

  const queryClient = useQueryClient();
  const riskKey = useSettingsStore(selectRiskConfig);
  const [parsedRiskPercent, parsedAtrMultiplier] = riskKey.split(':');
  const settingsRiskPercent = parsedRiskPercent ?? input.riskPercent;
  const settingsAtrMultiplier = parsedAtrMultiplier ?? input.atrMultiplier;
  const defaultTimeframe = useSettingsStore((state) => state.defaultTimeframe);
  const defaultSymbol = useSettingsStore((state) => state.defaultSymbol);
  const freshnessThreshold = useSettingsStore(selectFreshnessThreshold);
  const userId = useAuthStore((state) => state.userId ?? null);

  const latestPriceRef = useRef<string | null>(null);

  const {
    items: historyItems,
    query: historyQuery,
    addLocalItem,
    error: historyError,
  } = useTradeHistory();

  const {
    isFormOpen,
    formMode,
    fieldHandlers,
    openCreate,
    openEdit,
    closeForm,
    syncEntryFromMarket,
    onManualPreviewSuccess,
  } = useTradeCalculatorFormState({
    latestPriceRef,
    input,
    output,
  });

  const operations = useTradeCalculatorOperations({
    input,
    output,
    settingsRiskPercent,
    settingsAtrMultiplier,
    setStatus,
    setOutput,
    onManualPreviewSuccess,
    addLocalHistoryItem: addLocalItem,
    queryClient,
    userId,
  });

  const { marketStream } = useTradeCalculatorMarketWatcher({
    symbol: input.symbol,
    freshnessThreshold,
    latestPriceRef,
    onSnapshot: (incoming) => {
      syncEntryFromMarket(incoming.lastPrice);
    },
    onLiveTick: operations.requestLivePreview,
    onLagDetected: () => {
      setStatus('error', 'Refresh loop lag detected');
    },
  });

  useEffect(() => {
    if (
      input.riskPercent !== settingsRiskPercent ||
      input.atrMultiplier !== settingsAtrMultiplier ||
      input.timeframe !== defaultTimeframe ||
      input.symbol !== defaultSymbol
    ) {
      setInput({
        riskPercent: settingsRiskPercent,
        atrMultiplier: settingsAtrMultiplier,
        timeframe: defaultTimeframe,
        symbol: defaultSymbol,
      });
    }
  }, [
    defaultSymbol,
    defaultTimeframe,
    input.atrMultiplier,
    input.riskPercent,
    input.symbol,
    input.timeframe,
    setInput,
    settingsAtrMultiplier,
    settingsRiskPercent,
  ]);

  const riskSummary = useMemo(() => {
    const riskToReward = output?.riskToReward ?? null;
    if (riskToReward == null) {
      return {
        tone: 'neutral' as RiskTone,
        riskToReward,
        riskPercent: settingsRiskPercent,
      };
    }

    if (riskToReward > 1.5) {
      return { tone: 'positive' as RiskTone, riskToReward, riskPercent: settingsRiskPercent };
    }
    if (riskToReward < 1.2) {
      return { tone: 'negative' as RiskTone, riskToReward, riskPercent: settingsRiskPercent };
    }
    return { tone: 'neutral' as RiskTone, riskToReward, riskPercent: settingsRiskPercent };
  }, [output?.riskToReward, settingsRiskPercent]);

  const derivedValues = useMemo(() => {
    const effectiveStop = input.useVolatilityStop
      ? (output?.suggestedStop ?? null)
      : input.stopPrice;
    const visualizationStop = input.useVolatilityStop
      ? (output?.suggestedStop ?? '')
      : (input.stopPrice ?? '');
    const atrValue = output?.atr13 ?? snapshot?.atr13 ?? null;
    const marketPlaceholder = marketStream.snapshot?.lastPrice ?? 'Market';

    return {
      effectiveStop,
      visualizationStop,
      atrValue,
      marketPlaceholder,
    };
  }, [
    input.stopPrice,
    input.useVolatilityStop,
    marketStream.snapshot?.lastPrice,
    output,
    snapshot?.atr13,
  ]);

  const hasOutput = Boolean(output);
  const shouldShowErrorBanner = Boolean(hasOutput && status === 'error' && errorMessage);

  return {
    input,
    status,
    output,
    snapshot,
    warnings,
    lastUpdatedAt,
    errorMessage,
    hasOutput,
    isFormOpen,
    formMode,
    isSubmitting: operations.isSubmitting,
    isExecuting: operations.isExecuting,
    canExecute: operations.canExecute,
    marketStream,
    historyItems,
    historyQuery,
    historyError,
    riskSummary,
    derivedValues,
    shouldShowErrorBanner,
    actions: {
      openCreate,
      openEdit,
      closeForm,
      submitForm: operations.requestManualPreview,
      execute: operations.executeTrade,
    },
    fieldHandlers,
  };
};
