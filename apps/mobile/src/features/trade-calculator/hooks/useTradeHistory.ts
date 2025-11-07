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

  const lastLoggedErrorRef = useRef<string | null>(null);

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
