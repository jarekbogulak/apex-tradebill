import type { TradeCalculation } from '@apex-tradebill/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createApiClient, type TradeHistoryResponse } from '@/src/services/apiClient';
import { useAuthStore } from '@/src/state/authStore';
import type { ApiError } from '@/src/utils/api-error';

const apiClient = createApiClient();

export const tradeHistoryQueryKey = (userId: string | null | undefined) =>
  ['tradeHistory', userId ?? 'anonymous'] as const;

export const useTradeHistory = () => {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist?.hasHydrated?.() ?? false);

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

  const enabled = hydrated && Boolean(userId);

  const historyQuery = useQuery<TradeHistoryResponse, ApiError>({
    queryKey,
    queryFn: ({ signal }) =>
      apiClient.getTradeHistory({
        signal,
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled,
  });

  useEffect(() => {
    if (enabled) {
      return;
    }

    const reasons: string[] = [];
    if (!hydrated) {
      reasons.push('auth store not hydrated');
    }
    if (!userId) {
      reasons.push('missing userId');
    }

    console.warn('[tradeHistory] query disabled', {
      reasons,
      hydrated,
      userId,
    });
  }, [enabled, hydrated, userId]);

  const lastLoggedErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!historyQuery.isError) {
      lastLoggedErrorRef.current = null;
      return;
    }

    const payload = {
      message: historyQuery.error?.message ?? 'Unknown error',
      code: historyQuery.error?.code ?? null,
      status: historyQuery.error?.status ?? null,
      failureCount: historyQuery.failureCount,
    };
    const serialized = JSON.stringify(payload);

    if (lastLoggedErrorRef.current === serialized) {
      return;
    }

    lastLoggedErrorRef.current = serialized;
    console.warn('[tradeHistory] fetch failed', payload);
  }, [historyQuery.error, historyQuery.failureCount, historyQuery.isError]);

  useEffect(() => {
    const itemCount = historyQuery.data?.items?.length ?? 0;
    console.log('[tradeHistory] query state', {
      enabled,
      status: historyQuery.status,
      fetchStatus: historyQuery.fetchStatus,
      isFetching: historyQuery.isFetching,
      isLoading: historyQuery.isLoading,
      isSuccess: historyQuery.isSuccess,
      isError: historyQuery.isError,
      itemCount,
    });
  }, [
    enabled,
    historyQuery.data?.items?.length,
    historyQuery.fetchStatus,
    historyQuery.isError,
    historyQuery.isFetching,
    historyQuery.isLoading,
    historyQuery.isSuccess,
    historyQuery.status,
  ]);

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

  const error =
    enabled && historyQuery.isError
      ? (historyQuery.error ?? new Error('Failed to load trade history.'))
      : null;

  return {
    items,
    query: historyQuery,
    addLocalItem,
    error,
  };
};
