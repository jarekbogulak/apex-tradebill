import type { MarketSnapshot, TradeInput } from '@apex-tradebill/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMarketStream } from '@/src/features/stream/useMarketStream';
import {
  createRefreshScheduler,
  type RefreshScheduler,
} from '@/src/features/stream/refreshScheduler';
import { createApiClient } from '@/src/services/apiClient';
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
import { createCacheSyncWorker } from '@/src/sync/cacheSync';
import { useAuthStore } from '@/src/state/authStore';

import { useTradeHistory } from './useTradeHistory';

const apiClient = createApiClient();
const cacheSyncWorker = createCacheSyncWorker({
  getHeaders: () => {
    const { token, userId } = useAuthStore.getState();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (userId) {
      headers['x-user-id'] = userId;
    }
    return headers;
  },
});

type PreviewSource = 'manual' | 'live';

export type RiskTone = 'positive' | 'neutral' | 'negative';

const STOP_REQUIRED_ERROR = 'Stop price is required when volatility stop is disabled';

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
  marketStream: ReturnType<typeof useMarketStream>;
  historyItems: ReturnType<typeof useTradeHistory>['items'];
  historyQuery: ReturnType<typeof useTradeHistory>['query'];
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
  const hasManualEntry = useTradeCalculatorStore((state) => state.hasManualEntry);
  const setHasManualEntry = useTradeCalculatorStore((state) => state.setHasManualEntry);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>(output ? 'edit' : 'create');

  const queryClient = useQueryClient();
  const riskKey = useSettingsStore(selectRiskConfig);
  const [parsedRiskPercent, parsedAtrMultiplier] = riskKey.split(':');
  const settingsRiskPercent = parsedRiskPercent ?? input.riskPercent;
  const settingsAtrMultiplier = parsedAtrMultiplier ?? input.atrMultiplier;
  const defaultTimeframe = useSettingsStore((state) => state.defaultTimeframe);
  const defaultSymbol = useSettingsStore((state) => state.defaultSymbol);
  const freshnessThreshold = useSettingsStore(selectFreshnessThreshold);

  const latestPriceRef = useRef<string | null>(null);
  const requestSourceRef = useRef<PreviewSource>('manual');
  const livePreviewActiveRef = useRef(false);
  const livePreviewTickRef = useRef<() => void>(() => undefined);
  const isEntryFocusedRef = useRef(false);
  const hasManualEntryRef = useRef(hasManualEntry);
  const refreshSchedulerRef = useRef<RefreshScheduler | null>(null);

  useEffect(() => {
    if (!refreshSchedulerRef.current) {
      refreshSchedulerRef.current = createRefreshScheduler({
        telemetry: {
          onLagDetected: () => setStatus('error', 'Refresh loop lag detected'),
          onTick: () => livePreviewTickRef.current(),
        },
      });
    }

    const scheduler = refreshSchedulerRef.current;
    scheduler?.start();

    return () => {
      scheduler?.stop();
    };
  }, [setStatus]);

  useEffect(() => {
    cacheSyncWorker.start();
    return () => {
      cacheSyncWorker.stop();
    };
  }, []);

  useEffect(() => {
    hasManualEntryRef.current = hasManualEntry;
  }, [hasManualEntry]);

  const handleSnapshot = useCallback(
    (incoming: MarketSnapshot) => {
      latestPriceRef.current = incoming.lastPrice;
      if (!hasManualEntryRef.current && !isEntryFocusedRef.current) {
        setInput({ entryPrice: incoming.lastPrice });
      }
      refreshSchedulerRef.current?.recordHeartbeat();
    },
    [setInput],
  );

  const marketStream = useMarketStream({
    symbols: [input.symbol],
    staleThresholdMs: freshnessThreshold,
    onSnapshot: handleSnapshot,
  });

  const { items: historyItems, query: historyQuery, addLocalItem } = useTradeHistory();

  const buildTradePayload = useCallback((): TradeInput | null => {
    const normalize = (value: string | null | undefined) => {
      if (value == null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const { stopPrice: inputStopPrice, ...restInput } = input;

    const normalizedStop = normalize(inputStopPrice);
    const normalizedEntry = normalize(restInput.entryPrice);

    if (!input.useVolatilityStop && normalizedStop == null) {
      return null;
    }

    return {
      ...restInput,
      entryPrice: normalizedEntry,
      ...(normalizedStop != null ? { stopPrice: normalizedStop } : {}),
      riskPercent: settingsRiskPercent,
      atrMultiplier: settingsAtrMultiplier,
    } as TradeInput;
  }, [input, settingsAtrMultiplier, settingsRiskPercent]);

  const previewMutation = useMutation({
    mutationFn: (payload: TradeInput) => apiClient.previewTrade(payload),
    onMutate: () => {
      if (requestSourceRef.current === 'manual') {
        setStatus('loading');
      }
    },
    onSuccess: (data) => {
      setOutput(data.output, data.marketSnapshot, data.warnings, new Date().toISOString());
      setStatus('success');
      livePreviewActiveRef.current = true;
      if (requestSourceRef.current === 'manual') {
        setIsFormOpen(false);
        setFormMode('edit');
      }
    },
    onError: (error: Error) => {
      setStatus('error', error.message);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (payload: TradeInput) => apiClient.executeTrade(payload),
    onSuccess: (data) => {
      if (!data?.calculation) {
        setStatus('error', 'Execute response missing calculation payload');
        return;
      }
      setOutput(data.output, data.marketSnapshot, data.warnings, new Date().toISOString());
      setStatus('success');
      livePreviewActiveRef.current = true;
      addLocalItem(data.calculation);
      void queryClient.invalidateQueries({ queryKey: ['tradeHistory'], refetchType: 'active' });
    },
    onError: (error: Error) => {
      setStatus('error', error.message);
    },
  });

  const requestPreview = useCallback(
    (source: PreviewSource) => {
      if (source === 'live' && (!livePreviewActiveRef.current || previewMutation.isPending)) {
        return;
      }

      if (previewMutation.isPending && source === 'manual') {
        return;
      }

      const payload = buildTradePayload();
      if (!payload) {
        if (source === 'live') {
          livePreviewActiveRef.current = false;
        }
        setStatus('error', STOP_REQUIRED_ERROR);
        return;
      }

      requestSourceRef.current = source;

      previewMutation.mutate(payload);
    },
    [buildTradePayload, previewMutation, setStatus],
  );

  useEffect(() => {
    livePreviewTickRef.current = () => {
      requestPreview('live');
    };
  }, [requestPreview]);

  useEffect(() => {
    if (!output) {
      setFormMode('create');
    }
  }, [output]);

  const {
    riskPercent: inputRisk,
    atrMultiplier: inputAtr,
    timeframe: inputTimeframe,
    symbol: inputSymbol,
  } = input;

  useEffect(() => {
    if (
      inputRisk !== settingsRiskPercent ||
      inputAtr !== settingsAtrMultiplier ||
      inputTimeframe !== defaultTimeframe ||
      inputSymbol !== defaultSymbol
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
    inputAtr,
    inputRisk,
    inputSymbol,
    inputTimeframe,
    setInput,
    settingsAtrMultiplier,
    settingsRiskPercent,
  ]);

  const handleAccountSizeChange = useCallback(
    (value: string) => {
      setInput({ accountSize: value });
    },
    [setInput],
  );

  const handleEntryFocus = useCallback(() => {
    isEntryFocusedRef.current = true;
  }, []);

  const handleEntryBlur = useCallback(() => {
    isEntryFocusedRef.current = false;
    if (!hasManualEntryRef.current) {
      setInput({ entryPrice: latestPriceRef.current });
    }
  }, [setInput]);

  const handleEntryPriceChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        hasManualEntryRef.current = false;
        setHasManualEntry(false);
        setInput({ entryPrice: null });
      } else {
        hasManualEntryRef.current = true;
        setHasManualEntry(true);
        setInput({ entryPrice: value });
      }
    },
    [setHasManualEntry, setInput],
  );

  const handleTargetPriceChange = useCallback(
    (value: string) => {
      setInput({ targetPrice: value });
    },
    [setInput],
  );

  const handleStopPriceChange = useCallback(
    (value: string) => {
      if (value.trim().length === 0) {
        setInput({ stopPrice: null });
      } else {
        setInput({ stopPrice: value });
      }
    },
    [setInput],
  );

  const handleVolatilityToggle = useCallback(
    (value: boolean) => {
      if (value) {
        setInput({ useVolatilityStop: true, stopPrice: null });
      } else {
        const fallbackStop =
          output?.suggestedStop ?? input.stopPrice ?? latestPriceRef.current ?? '0.00';
        setInput({ useVolatilityStop: false, stopPrice: fallbackStop });
      }
    },
    [input.stopPrice, output, setInput],
  );

  const handleDirectionChange = useCallback(
    (direction: 'long' | 'short') => {
      setInput({ direction });
    },
    [setInput],
  );

  const openCreate = useCallback(() => {
    setFormMode('create');
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback(() => {
    setFormMode('edit');
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
  }, []);

  const submitForm = useCallback(() => {
    requestPreview('manual');
  }, [requestPreview]);

  const executeTrade = useCallback(() => {
    if (!output || executeMutation.isPending) {
      return;
    }

    const payload = buildTradePayload();
    if (!payload) {
      setStatus('error', STOP_REQUIRED_ERROR);
      return;
    }

    executeMutation.mutate(payload);
  }, [buildTradePayload, executeMutation, output, setStatus]);

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
  const canExecute = Boolean(output) && !executeMutation.isPending;

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
    isSubmitting: previewMutation.isPending,
    isExecuting: executeMutation.isPending,
    canExecute,
    marketStream,
    historyItems,
    historyQuery,
    riskSummary,
    derivedValues,
    shouldShowErrorBanner,
    actions: {
      openCreate,
      openEdit,
      closeForm,
      submitForm,
      execute: executeTrade,
    },
    fieldHandlers: {
      onAccountSizeChange: handleAccountSizeChange,
      onEntryFocus: handleEntryFocus,
      onEntryBlur: handleEntryBlur,
      onEntryPriceChange: handleEntryPriceChange,
      onTargetPriceChange: handleTargetPriceChange,
      onStopPriceChange: handleStopPriceChange,
      onVolatilityToggle: handleVolatilityToggle,
      onDirectionChange: handleDirectionChange,
    },
  };
};
