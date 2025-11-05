import { useCallback, useRef } from 'react';
import type { TradeCalculation, TradeInput } from '@apex-tradebill/types';
import { useMutation, type QueryClient } from '@tanstack/react-query';

import { createApiClient } from '@/src/services/apiClient';
import { tradeHistoryQueryKey } from './useTradeHistory';
import {
  type TradeCalculatorInputState,
  type TradeCalculatorState,
  type TradeCalculatorStatus,
} from '@/src/state/tradeCalculatorStore';

const apiClient = createApiClient();

type PreviewSource = 'manual' | 'live';

const STOP_REQUIRED_ERROR = 'Stop price is required when volatility stop is disabled';

interface UseTradeCalculatorOperationsOptions {
  input: TradeCalculatorInputState;
  output: TradeCalculatorState['output'];
  settingsRiskPercent: string;
  settingsAtrMultiplier: string;
  setStatus: (status: TradeCalculatorStatus, error?: string | null) => void;
  setOutput: TradeCalculatorState['setOutput'];
  onManualPreviewSuccess: () => void;
  addLocalHistoryItem: (item: TradeCalculation) => void;
  queryClient: QueryClient;
  userId: string | null;
}

interface UseTradeCalculatorOperationsResult {
  requestManualPreview: () => void;
  requestLivePreview: () => void;
  executeTrade: () => void;
  isSubmitting: boolean;
  isExecuting: boolean;
  canExecute: boolean;
}

export const useTradeCalculatorOperations = ({
  input,
  output,
  settingsRiskPercent,
  settingsAtrMultiplier,
  setStatus,
  setOutput,
  onManualPreviewSuccess,
  addLocalHistoryItem,
  queryClient,
  userId,
}: UseTradeCalculatorOperationsOptions): UseTradeCalculatorOperationsResult => {
  const requestSourceRef = useRef<PreviewSource>('manual');
  const livePreviewActiveRef = useRef(false);

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
        onManualPreviewSuccess();
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
      addLocalHistoryItem(data.calculation);
      queryClient.invalidateQueries({
        queryKey: tradeHistoryQueryKey(userId),
        refetchType: 'active',
      });
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

  const requestManualPreview = useCallback(() => {
    requestPreview('manual');
  }, [requestPreview]);

  const requestLivePreview = useCallback(() => {
    requestPreview('live');
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

  const canExecute = Boolean(output) && !executeMutation.isPending;

  return {
    requestManualPreview,
    requestLivePreview,
    executeTrade,
    isSubmitting: previewMutation.isPending,
    isExecuting: executeMutation.isPending,
    canExecute,
  };
};
