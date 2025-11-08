import type { TradeCalculation } from '@apex-tradebill/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createApiClient, type TradeHistoryResponse } from '@/src/services/apiClient';
import { useAuthStore } from '@/src/state/authStore';
import { isApiError, type ApiError } from '@/src/utils/api-error';

const apiClient = createApiClient();
const AUTO_REFETCH_INTERVAL_MS = 30_000;

export const tradeHistoryQueryKey = (userId: string | null | undefined) =>
  ['tradeHistory', userId ?? 'anonymous'] as const;

export const useTradeHistory = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist?.hasHydrated?.() ?? false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      setHydrated(true);
    });
    return () => {
      unsub?.();
    };
  }, [hydrated]);

  const queryKey = useMemo(() => tradeHistoryQueryKey(userId), [userId]);

  const enabled = hydrated;

  const historyQuery = useQuery<TradeHistoryResponse, ApiError>({
    queryKey,
    queryFn: ({ signal }) =>
      apiClient.getTradeHistory({
        signal,
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled,
    retry: 0,
  });

  useEffect(() => {
    if (historyQuery.isFetching) {
      return;
    }

    if (historyQuery.isSuccess) {
      setHistoryUnavailable(false);
      setLastCheckedAt(Date.now());
      return;
    }

    if (historyQuery.isError) {
      const unavailable = historyQuery.error
        ? isApiError(historyQuery.error) &&
          (historyQuery.error.code === 'HISTORY_UNAVAILABLE' || historyQuery.error.status === 503)
        : false;
      setHistoryUnavailable(unavailable);
      setLastCheckedAt(Date.now());
    }
  }, [historyQuery.isError, historyQuery.isFetching, historyQuery.isSuccess, historyQuery.error]);

  const { refetch } = historyQuery;

  useEffect(() => {
    if (!historyUnavailable) {
      return () => undefined;
    }

    const id = setInterval(() => {
      void refetch();
    }, AUTO_REFETCH_INTERVAL_MS);

    return () => {
      clearInterval(id);
    };
  }, [historyUnavailable, refetch]);

  const addLocalItem = useCallback(
    (item: TradeCalculation) => {
      queryClient.setQueryData<TradeHistoryResponse>(queryKey, (current) => {
        const base: TradeHistoryResponse = current ?? {
          items: [],
          nextCursor: null,
        };
        const deduped = base.items.filter((existing) => existing.id !== item.id);
        return {
          ...base,
          items: [item, ...deduped],
        };
      });
    },
    [queryClient, queryKey],
  );

  const items = useMemo(() => {
    if (!enabled) {
      return [] as TradeCalculation[];
    }
    return historyQuery.data?.items ?? [];
  }, [enabled, historyQuery.data?.items]);

  const error = historyQuery.isError
    ? (historyQuery.error ?? new Error('Failed to load trade history.'))
    : null;

  return {
    items,
    query: historyQuery,
    addLocalItem,
    error,
    isUnavailable: historyUnavailable,
    lastCheckedAt,
    autoRetryIntervalMs: historyUnavailable ? AUTO_REFETCH_INTERVAL_MS : null,
  };
};
