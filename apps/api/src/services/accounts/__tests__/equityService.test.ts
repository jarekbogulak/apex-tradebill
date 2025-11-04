import { createEquityService } from '../equityService.js';
import type { AccountEquityPort } from '../../../domain/ports/tradebillPorts.js';

describe('Equity service', () => {
  test('exposes latest equity snapshots', async () => {
    const store = new Map<string, { equity: string; lastSyncedAt: string }>();
    const port: AccountEquityPort = {
      async getEquity(userId) {
        const entry = store.get(userId);
        if (!entry) {
          return null;
        }
        return {
          source: 'manual' as const,
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

    const service = createEquityService({ equityPort: port });
    await service.setManualEquity('user-equity', '1500.00');
    const snapshot = await service.getLatestEquity('user-equity');
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

    const service = createEquityService({ equityPort: port });
    await expect(service.setManualEquity('user', '-1')).rejects.toThrow(
      'Equity cannot be negative',
    );
  });
});
