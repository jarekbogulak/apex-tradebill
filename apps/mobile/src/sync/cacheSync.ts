import type { TradeCalculation } from '@apex-tradebill/types';
import {
  listDeviceCacheEntries,
  markDeviceCacheEntrySynced,
  removeDeviceCacheEntry,
  toTradeCalculation,
  type DeviceCacheEntry,
} from '../storage/device-cache-entry.ts';
import { env } from '../config/env';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface CacheSyncHeadersProvider {
  (): Promise<Record<string, string>> | Record<string, string>;
}

export interface CacheSyncOptions {
  apiBaseUrl?: string;
  intervalMs?: number;
  maxBatchSize?: number;
  now?: () => Date;
  getHeaders?: CacheSyncHeadersProvider;
  onSynced?: (entries: TradeCalculation[]) => void;
}

export interface CacheSyncWorker {
  start(): void;
  stop(): void;
  syncNow(): Promise<void>;
  isRunning(): boolean;
}

const defaultHeaders = () => ({
  'Content-Type': 'application/json',
});

const buildRequestHeaders = async (
  getHeaders?: CacheSyncHeadersProvider,
): Promise<Record<string, string>> => {
  const base = defaultHeaders();
  if (!getHeaders) {
    return base;
  }

  const extra = await getHeaders();
  return {
    ...base,
    ...extra,
  };
};

const shouldRemoveEntry = (entry: DeviceCacheEntry, now: Date): boolean => {
  const createdAtMs = Date.parse(entry.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return now.getTime() - createdAtMs > THIRTY_DAYS_MS;
};

const extractSyncedIds = (response: unknown): string[] => {
  if (!response || typeof response !== 'object') {
    return [];
  }
  const maybeIds = (response as { syncedIds?: unknown }).syncedIds;
  if (!Array.isArray(maybeIds)) {
    return [];
  }
  return maybeIds.filter((value): value is string => typeof value === 'string');
};

export const createCacheSyncWorker = ({
  apiBaseUrl = env.api.baseUrl,
  intervalMs = 60_000,
  maxBatchSize = 10,
  now = () => new Date(),
  getHeaders,
  onSynced,
}: CacheSyncOptions = {}): CacheSyncWorker => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let syncing = false;

  const syncEntries = async (): Promise<void> => {
    if (syncing) {
      return;
    }
    syncing = true;

    try {
      const entries = await listDeviceCacheEntries(maxBatchSize);
      if (entries.length === 0) {
        return;
      }

      const calculations = entries.map((entry) => ({
        entry,
        calculation: toTradeCalculation(entry),
      }));

      const payloadEntries = calculations.map(({ entry, calculation }) => ({
        id: entry.id,
        input: entry.input,
        output: entry.output,
        marketSnapshot: calculation.marketSnapshot,
        source: calculation.source,
        createdAt: entry.createdAt,
        executionMethod: entry.executionMethod,
        executedAt: entry.executedAt,
      }));
      const headers = await buildRequestHeaders(getHeaders);

      const response = await fetch(`${apiBaseUrl}/v1/trades/history/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entries: payloadEntries,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Cache sync failed (${response.status}): ${body}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const syncedIds = extractSyncedIds(payload);
      const currentTime = now();
      const timestamp = currentTime.toISOString();

      for (const { entry } of calculations) {
        if (syncedIds.length > 0 && !syncedIds.includes(entry.id)) {
          continue;
        }
        await markDeviceCacheEntrySynced(entry.id, timestamp);
        if (shouldRemoveEntry(entry, currentTime)) {
          await removeDeviceCacheEntry(entry.id);
        }
      }

      onSynced?.(calculations.map((item) => item.calculation));
    } catch (error) {
      console.warn('device-cache.sync.failed', error);
    } finally {
      syncing = false;
    }
  };

  return {
    start() {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        void syncEntries();
      }, intervalMs);
      void syncEntries();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    syncNow: async () => {
      await syncEntries();
    },
    isRunning() {
      return timer != null;
    },
  };
};
