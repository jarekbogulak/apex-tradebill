import type { TradeCalculation } from '@apex-tradebill/types';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { createApiClient } from '@/src/services/apiClient';

const apiClient = createApiClient();

interface TradeHistoryPage {
  items?: TradeCalculation[];
  nextCursor?: string | null;
}

/**
 * Retrieves paginated trade history and flattens the items for consumption by the UI.
 */
export const useTradeHistory = () => {
  const historyQuery = useInfiniteQuery({
    queryKey: ['tradeHistory'],
    queryFn: ({ pageParam }) =>
      apiClient.getTradeHistory({
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
      }),
    getNextPageParam: (lastPage: TradeHistoryPage) => lastPage?.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const items = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page?.items ?? []) ?? [],
    [historyQuery.data],
  );

  return {
    items,
    query: historyQuery,
  };
};
