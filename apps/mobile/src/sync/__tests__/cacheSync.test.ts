jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  get(name: string) {
    if (name === 'SourceCode') {
      return { scriptURL: 'http://localhost' };
    }
    return {};
  },
  getEnforcing(name: string) {
    const module = (this as { get: (name: string) => unknown }).get(name);
    if (!module) {
      throw new Error(`TurboModuleRegistry mock missing module: ${name}`);
    }
    return module;
  },
}));

jest.mock('../../storage/device-cache-entry.js');

import type { TradeCalculation } from '@apex-tradebill/types';
import * as deviceCacheEntry from '../../storage/device-cache-entry.js';
import { createCacheSyncWorker } from '../cacheSync.js';

const mockListDeviceCacheEntries = deviceCacheEntry
  .listDeviceCacheEntries as jest.Mock;
const mockMarkDeviceCacheEntrySynced = deviceCacheEntry
  .markDeviceCacheEntrySynced as jest.Mock;
const mockRemoveDeviceCacheEntry = deviceCacheEntry
  .removeDeviceCacheEntry as jest.Mock;
const mockToTradeCalculation = deviceCacheEntry.toTradeCalculation as jest.Mock;

const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn() as unknown as typeof global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const buildEntry = () => ({
  id: 'entry-1',
  input: {
    symbol: 'BTC-USDT',
    direction: 'long',
    accountSize: '1000',
    entryPrice: '100',
    stopPrice: '95',
    targetPrice: '120',
    riskPercent: '0.02',
    atrMultiplier: '1.50',
    useVolatilityStop: false,
    timeframe: '15m',
    accountEquitySource: 'manual',
  },
  output: {
    positionSize: '1.000000',
    positionCost: '100.00',
    riskAmount: '20.00',
    riskToReward: 2,
    suggestedStop: '95.00',
    atr13: '0.00000000',
    warnings: [],
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  syncedAt: null,
  dirty: true,
});

describe('createCacheSyncWorker', () => {
  it('uploads cached entries and reconciles synced state', async () => {
    const entry = buildEntry();
    const calculation: TradeCalculation = {
      id: entry.id,
      userId: 'local-device',
      input: entry.input,
      output: entry.output,
      marketSnapshot: {
        symbol: entry.input.symbol,
        lastPrice: '100.00',
        bid: null,
        ask: null,
        atr13: '0.00000000',
        atrMultiplier: '1.50',
        stale: true,
        source: 'manual',
        serverTimestamp: entry.createdAt,
      },
      source: 'manual',
      createdAt: entry.createdAt,
    };

    mockListDeviceCacheEntries.mockResolvedValue([entry]);
    mockToTradeCalculation.mockReturnValue(calculation);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ syncedIds: [entry.id] }),
      text: jest.fn(),
    });

    const getHeaders = jest.fn().mockResolvedValue({ Authorization: 'Bearer token' });
    const onSynced = jest.fn();
    const now = () => new Date('2025-03-01T00:00:00.000Z');

    const worker = createCacheSyncWorker({
      apiBaseUrl: 'https://api.tradebill.dev',
      getHeaders,
      onSynced,
      now,
    });

    await worker.syncNow();

    expect(getHeaders).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.tradebill.dev/v1/trades/history/import',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(mockMarkDeviceCacheEntrySynced).toHaveBeenCalledWith(
      entry.id,
      '2025-03-01T00:00:00.000Z',
    );
    expect(mockRemoveDeviceCacheEntry).toHaveBeenCalledWith(entry.id);
    expect(onSynced).toHaveBeenCalledWith([calculation]);
  });

  it('logs warnings and preserves cache when the API rejects', async () => {
    const entry = buildEntry();
    mockListDeviceCacheEntries.mockResolvedValue([entry]);
    mockToTradeCalculation.mockReturnValue({
      id: entry.id,
      userId: 'user',
      input: entry.input,
      output: entry.output,
      marketSnapshot: {
        symbol: entry.input.symbol,
        lastPrice: '100.00',
        bid: null,
        ask: null,
        atr13: '0.00000000',
        atrMultiplier: '1.50',
        stale: true,
        source: 'manual',
        serverTimestamp: entry.createdAt,
      },
      source: 'manual',
      createdAt: entry.createdAt,
    } satisfies TradeCalculation);

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn(),
      text: jest.fn().mockResolvedValue('server error'),
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const worker = createCacheSyncWorker({
      apiBaseUrl: 'https://api.tradebill.dev',
      now: () => new Date('2025-01-02T00:00:00.000Z'),
    });

    await worker.syncNow();

    expect(warnSpy).toHaveBeenCalledWith(
      'device-cache.sync.failed',
      expect.any(Error),
    );
    expect(mockMarkDeviceCacheEntrySynced).not.toHaveBeenCalled();
    expect(mockRemoveDeviceCacheEntry).not.toHaveBeenCalled();
  });

  it('starts and stops scheduled synchronization', async () => {
    jest.useFakeTimers();
    mockListDeviceCacheEntries.mockResolvedValue([]);

    const worker = createCacheSyncWorker({ intervalMs: 1_000 });

    worker.start();
    await Promise.resolve();
    expect(worker.isRunning()).toBe(true);

    expect(mockListDeviceCacheEntries).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    expect(mockListDeviceCacheEntries).toHaveBeenCalledTimes(2);

    worker.stop();
    expect(worker.isRunning()).toBe(false);
  });
});
