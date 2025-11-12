import { makeGetEquitySnapshot, makeSetManualEquity } from '../equity.usecases.js';
import type { AccountEquityPort } from '../../ports/tradebillPorts.js';

describe('Equity use cases', () => {
  test('exposes latest equity snapshots', async () => {
    const store = new Map<string, { equity: string; lastSyncedAt: string }>();
    const port: AccountEquityPort = {
      async getEquity(userId) {
        const entry = store.get(userId);
        if (!entry) {
          return null;
        }
        return {
          source: 'manual',
          equity: entry.equity,
          lastSyncedAt: entry.lastSyncedAt,
        };
      },
      async setManualEquity(userId, equity) {
        const snapshot = {
          source: 'manual' as const,
          equity,
          lastSyncedAt: new Date().toISOString(),
        };
        store.set(userId, snapshot);
        return snapshot;
      },
    };

    const setManualEquity = makeSetManualEquity({ equityPort: port });
    const getEquitySnapshot = makeGetEquitySnapshot({ equityPort: port });

    await setManualEquity('user-equity', '1500.00');
    const snapshot = await getEquitySnapshot('user-equity');
    expect(snapshot.equity).toBe('1500.00');
  });

  test('rejects negative equity values', async () => {
    const port: AccountEquityPort = {
      async getEquity() {
        return null;
      },
      async setManualEquity() {
        throw new Error('Should not be called');
      },
    };

    const setManualEquity = makeSetManualEquity({ equityPort: port });
    await expect(setManualEquity('user', '-1')).rejects.toThrow('Equity cannot be negative');
  });

  test('rejects missing snapshots', async () => {
    const port: AccountEquityPort = {
      async getEquity() {
        return null;
      },
      async setManualEquity(userId, equity) {
        return {
          source: 'manual',
          equity,
          lastSyncedAt: new Date().toISOString(),
        };
      },
    };

    const getEquitySnapshot = makeGetEquitySnapshot({ equityPort: port });
    await expect(getEquitySnapshot('user')).rejects.toThrow('No equity snapshot available');
  });
});
