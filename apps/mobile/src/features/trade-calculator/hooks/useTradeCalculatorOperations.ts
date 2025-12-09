import { useCallback, useRef } from 'react';
import type { TradeCalculation, TradeInput } from '@apex-tradebill/types';
import { useMutation, type QueryClient } from '@tanstack/react-query';

import {
  createApiClient,
  type TradePreviewResponse,
  type TradeExecuteResponse,
} from '@/src/services/apiClient';
import { tradeHistoryQueryKey } from './useTradeHistory';
import {
  type TradeCalculatorInputState,
  type TradeCalculatorState,
  type TradeCalculatorStatus,
} from '@/src/state/tradeCalculatorStore';
import type { ApiError } from '@/src/utils/api-error';
import { formatFriendlyError } from '@/src/utils/api-error';

const apiClient = createApiClient();

type PreviewSource = 'manual' | 'live';

const STOP_REQUIRED_ERROR = 'Stop price is required when volatility stop is disabled';
const ACCOUNT_SIZE_REQUIRED_ERROR = 'Account size must be greater than zero';
const PREVIEW_ERROR_FALLBACK =
  'Unable to preview this trade. Double-check the form inputs and try again.';
const EXECUTE_ERROR_FALLBACK = 'Unable to execute this trade. Please try again in a moment.';
const RISK_PERCENT_ERROR = 'Risk percent must be between 0 and 1. Update it in Settings.';
const ATR_MULTIPLIER_ERROR = 'ATR multiplier must be between 0.5 and 3. Update it in Settings.';

const decimalPattern = /^-?\d+(?:\.\d+)?$/;

const normalizeDecimalString = (value: string | null | undefined): string => {
  return (value ?? '').trim();
};

const parseDecimal = (value: string): number | null => {
  if (!decimalPattern.test(value)) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeNullable = (value: string | null | undefined) => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const prepareTradePayload = ({
  input,
  settingsRiskPercent,
  settingsAtrMultiplier,
}: {
  input: TradeCalculatorInputState;
  settingsRiskPercent: string;
  settingsAtrMultiplier: string;
}): { payload: TradeInput | null; error: string | null } => {
  const { stopPrice: inputStopPrice, ...restInput } = input;

  const normalizedRiskPercent = normalizeDecimalString(settingsRiskPercent);
  const normalizedAtrMultiplier = normalizeDecimalString(settingsAtrMultiplier);

  const parsedRiskPercent = parseDecimal(normalizedRiskPercent);
  if (parsedRiskPercent == null || parsedRiskPercent <= 0 || parsedRiskPercent > 1) {
    return { payload: null, error: RISK_PERCENT_ERROR };
  }

  const parsedAtrMultiplier = parseDecimal(normalizedAtrMultiplier);
  if (parsedAtrMultiplier == null || parsedAtrMultiplier < 0.5 || parsedAtrMultiplier > 3) {
    return { payload: null, error: ATR_MULTIPLIER_ERROR };
  }

  const normalizedStop = normalizeNullable(inputStopPrice);
  const normalizedEntry = normalizeNullable(restInput.entryPrice);
  const normalizedAccountSize = normalizeNullable(restInput.accountSize);

  if (!normalizedAccountSize) {
    return { payload: null, error: ACCOUNT_SIZE_REQUIRED_ERROR };
  }

  const accountSizeValue = Number(normalizedAccountSize);
  if (!Number.isFinite(accountSizeValue) || accountSizeValue <= 0) {
    return { payload: null, error: ACCOUNT_SIZE_REQUIRED_ERROR };
  }

  if (!input.useVolatilityStop && normalizedStop == null) {
    return { payload: null, error: STOP_REQUIRED_ERROR };
  }

  const payload: TradeInput = {
    ...restInput,
    accountSize: normalizedAccountSize,
    entryPrice: normalizedEntry,
    riskPercent: normalizedRiskPercent,
    atrMultiplier: normalizedAtrMultiplier,
    ...(normalizedStop != null ? { stopPrice: normalizedStop } : {}),
  } as TradeInput;

  return { payload, error: null };
};

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

  const previewMutation = useMutation<TradePreviewResponse, ApiError, TradeInput>({
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
    onError: (error: ApiError) => {
      if (requestSourceRef.current === 'live') {
        livePreviewActiveRef.current = false;
        return;
      }
      setStatus('error', formatFriendlyError(error, PREVIEW_ERROR_FALLBACK));
    },
  });

  const executeMutation = useMutation<TradeExecuteResponse, ApiError, TradeInput>({
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
    onError: (error: ApiError) => {
      setStatus('error', formatFriendlyError(error, EXECUTE_ERROR_FALLBACK));
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

      const { payload, error } = prepareTradePayload({
        input,
        settingsRiskPercent,
        settingsAtrMultiplier,
      });

      if (!payload) {
        if (source === 'live') {
          livePreviewActiveRef.current = false;
          return;
        }
        setStatus('error', error ?? STOP_REQUIRED_ERROR);
        return;
      }

      requestSourceRef.current = source;
      previewMutation.mutate(payload);
    },
    [input, previewMutation, setStatus, settingsAtrMultiplier, settingsRiskPercent],
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

    const { payload, error } = prepareTradePayload({
      input,
      settingsRiskPercent,
      settingsAtrMultiplier,
    });

    if (!payload) {
      setStatus('error', error ?? STOP_REQUIRED_ERROR);
      return;
    }

    executeMutation.mutate(payload);
  }, [executeMutation, input, output, setStatus, settingsAtrMultiplier, settingsRiskPercent]);

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
