import type { TradeCalculation } from '@apex-tradebill/types';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createApiClient, type TradeHistoryResponse } from '@/src/services/apiClient';
import { useAuthStore } from '@/src/state/authStore';

const apiClient = createApiClient();

export const useTradeHistory = () => {
  const [localItems, setLocalItems] = useState<TradeCalculation[]>([]);
  const token = useAuthStore((state) => state.token);
  const [error, setError] = useState<Error | null>(null);
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

  const historyQuery = useQuery<TradeHistoryResponse, Error>({
    queryKey: ['tradeHistory'],
    queryFn: ({ signal }) =>
      apiClient.getTradeHistory({
        signal,
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: hydrated && Boolean(token),
  });

  useEffect(() => {
    if (hydrated && token) {
      historyQuery.refetch().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token]);

  useEffect(() => {
    if (!hydrated || !token) {
      if (!token) {
        setError(null);
      }
      return;
    }

    const queryError = historyQuery.error;
    if (queryError) {
      setError(queryError);
      return;
    }

    if (historyQuery.data) {
      setError(null);
    }
  }, [historyQuery.data, historyQuery.error, hydrated, token]);

  useEffect(() => {
    if (!hydrated || !token) {
      return;
    }

    const remoteItems = historyQuery.data?.items ?? [];
    if (remoteItems.length === 0) {
      return;
    }

    setLocalItems((current) =>
      current.filter((item) => !remoteItems.some((remote) => remote.id === item.id)),
    );
  }, [historyQuery.data?.items, hydrated, token]);

  const addLocalItem = useCallback((item: TradeCalculation) => {
    setLocalItems((current) => {
      const deduped = current.filter((existing) => existing.id !== item.id);
      return [item, ...deduped];
    });
  }, []);

  const items = useMemo(() => {
    const remoteItems = historyQuery.data?.items ?? [];
    const unsynced = localItems.filter(
      (item) => !remoteItems.some((remote) => remote.id === item.id),
    );
    return [...unsynced, ...remoteItems];
  }, [historyQuery.data?.items, localItems]);

  return {
    items,
    query: historyQuery,
    addLocalItem,
    error,
  };
};
