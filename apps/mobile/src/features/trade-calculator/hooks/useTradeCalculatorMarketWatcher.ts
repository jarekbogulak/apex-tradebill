import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { MarketSnapshot } from '@apex-tradebill/types';

import { useMarketStream } from '@/src/features/stream/useMarketStream';
import {
  createRefreshScheduler,
  type RefreshScheduler,
} from '@/src/features/stream/refreshScheduler';
import { createCacheSyncWorker } from '@/src/sync/cacheSync';
import { useAuthStore } from '@/src/state/authStore';

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

interface UseTradeCalculatorMarketWatcherOptions {
  symbol: string;
  freshnessThreshold: number;
  latestPriceRef: MutableRefObject<string | null>;
  onSnapshot: (snapshot: MarketSnapshot) => void;
  onLiveTick: () => void;
  onLagDetected: (lagMs: number) => void;
}

export const useTradeCalculatorMarketWatcher = ({
  symbol,
  freshnessThreshold,
  latestPriceRef,
  onSnapshot,
  onLiveTick,
  onLagDetected,
}: UseTradeCalculatorMarketWatcherOptions) => {
  const refreshSchedulerRef = useRef<RefreshScheduler | null>(null);

  useEffect(() => {
    const scheduler = createRefreshScheduler({
      telemetry: {
        onTick: () => {
          onLiveTick();
        },
        onLagDetected,
      },
    });
    refreshSchedulerRef.current = scheduler;
    scheduler.start();
    return () => {
      scheduler.stop();
      if (refreshSchedulerRef.current === scheduler) {
        refreshSchedulerRef.current = null;
      }
    };
  }, [onLagDetected, onLiveTick]);

  useEffect(() => {
    cacheSyncWorker.start();
    return () => {
      cacheSyncWorker.stop();
    };
  }, []);

  const handleSnapshot = useCallback(
    (incoming: MarketSnapshot) => {
      latestPriceRef.current = incoming.lastPrice;
      onSnapshot(incoming);
      refreshSchedulerRef.current?.recordHeartbeat();
    },
    [latestPriceRef, onSnapshot],
  );

  const marketStream = useMarketStream({
    symbols: [symbol],
    staleThresholdMs: freshnessThreshold,
    onSnapshot: handleSnapshot,
  });

  return {
    marketStream,
  };
};
