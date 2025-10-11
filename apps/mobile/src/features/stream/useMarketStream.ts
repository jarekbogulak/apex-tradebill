import type { MarketSnapshot, Symbol } from '@apex-tradebill/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_STALE_THRESHOLD_MS = 2000;
const WS_RETRY_DELAYS = [1000, 2000, 5000];

export type StreamStatus = 'disconnected' | 'connecting' | 'connected' | 'stale';

export interface MarketStreamOptions {
  symbols?: Symbol[];
  staleThresholdMs?: number;
  onSnapshot?: (snapshot: MarketSnapshot) => void;
  enabled?: boolean;
}

interface MarketStreamState {
  status: StreamStatus;
  snapshot: MarketSnapshot | null;
  lastUpdatedAt: number | null;
  reconnectAttempts: number;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export const useMarketStream = ({
  symbols,
  staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
  onSnapshot,
  enabled = true,
}: MarketStreamOptions = {}) => {
  const [state, setState] = useState<MarketStreamState>({
    status: 'disconnected',
    snapshot: null,
    lastUpdatedAt: null,
    reconnectAttempts: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStaleTimer = () => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  };

  const scheduleStaleCheck = useCallback(
    (timestamp: number) => {
      clearStaleTimer();
      staleTimerRef.current = setTimeout(() => {
        setState((current) => ({
          ...current,
          status: 'stale',
        }));
      }, staleThresholdMs - (Date.now() - timestamp));
    },
    [staleThresholdMs],
  );

  const closeSocket = useCallback(() => {
    clearStaleTimer();
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const connect = useCallback(
    (attempt = 0) => {
      if (!enabled) {
        return;
      }

      closeSocket();

      const query = symbols && symbols.length > 0 ? `?symbols=${symbols.join(',')}` : '';
      const socket = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/v1/stream/market-data${query}`);
      wsRef.current = socket;

      setState((current) => ({
        ...current,
        status: 'connecting',
        reconnectAttempts: attempt,
      }));

      socket.onopen = () => {
        setState((current) => ({
          ...current,
          status: 'connected',
          reconnectAttempts: 0,
        }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type: string;
            data: MarketSnapshot;
          };

          if (payload.type === 'market.snapshot') {
            scheduleStaleCheck(Date.now());
            setState((current) => ({
              ...current,
              status: 'connected',
              snapshot: payload.data,
              lastUpdatedAt: Date.now(),
            }));
            onSnapshot?.(payload.data);
          }
        } catch (error) {
          console.warn('Failed to parse market snapshot', error);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        clearStaleTimer();
        setState((current) => ({
          ...current,
          status: 'disconnected',
        }));

        const nextAttempt = attempt + 1;
        const delay = WS_RETRY_DELAYS[Math.min(attempt, WS_RETRY_DELAYS.length - 1)];
        if (enabled) {
          setTimeout(() => connect(nextAttempt), delay);
        }
      };
    },
    [closeSocket, enabled, onSnapshot, scheduleStaleCheck, symbols],
  );

  useEffect(() => {
    if (!enabled) {
      return () => undefined;
    }

    connect();
    return () => {
      closeSocket();
    };
  }, [connect, closeSocket, enabled]);

  return {
    status: state.status,
    snapshot: state.snapshot,
    lastUpdatedAt: state.lastUpdatedAt,
    reconnectAttempts: state.reconnectAttempts,
    reconnect: () => connect(0),
    disconnect: closeSocket,
  } as const;
};
