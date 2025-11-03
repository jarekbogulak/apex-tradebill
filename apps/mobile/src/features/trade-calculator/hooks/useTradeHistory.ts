import type { TradeCalculation } from '@apex-tradebill/types';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createApiClient } from '@/src/services/apiClient';

const apiClient = createApiClient();

export const useTradeHistory = () => {
  const [localItems, setLocalItems] = useState<TradeCalculation[]>([]);

  const historyQuery = useQuery({
    queryKey: ['tradeHistory'],
    queryFn: ({ signal }) =>
      apiClient.getTradeHistory({
        signal,
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  useEffect(() => {
    const remoteItems = historyQuery.data?.items ?? [];
    if (remoteItems.length === 0) {
      return;
    }

    setLocalItems((current) =>
      current.filter((item) => !remoteItems.some((remote) => remote.id === item.id)),
    );
  }, [historyQuery.data?.items]);

  const addLocalItem = useCallback((item: TradeCalculation) => {
    setLocalItems((current) => {
      const deduped = current.filter((existing) => existing.id !== item.id);
      return [item, ...deduped];
    });
  }, []);

  const items = useMemo(
    () => {
      const remoteItems = historyQuery.data?.items ?? [];
      const unsynced = localItems.filter(
        (item) => !remoteItems.some((remote) => remote.id === item.id),
      );
      return [...unsynced, ...remoteItems];
    },
    [historyQuery.data?.items, localItems],
  );

  return {
    items,
    query: historyQuery,
    addLocalItem,
  };
};
