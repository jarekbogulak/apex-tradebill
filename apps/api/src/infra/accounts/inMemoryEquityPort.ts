import type { AccountEquityPort } from '../../domain/ports/tradebillPorts.js';

type EquitySource = 'connected' | 'manual';

interface EquitySnapshot {
  source: EquitySource;
  equity: string;
  lastSyncedAt: string;
}

export interface CreateInMemoryEquityPortOptions {
  seedUserId?: string;
  seedEquity?: string;
  seedSource?: EquitySource;
  seedSyncedAt?: string;
}

export const createInMemoryEquityPort = ({
  seedUserId,
  seedEquity = '25000.00',
  seedSource = 'connected',
  seedSyncedAt = new Date().toISOString(),
}: CreateInMemoryEquityPortOptions = {}): AccountEquityPort => {
  const store = new Map<string, EquitySnapshot>();

  if (seedUserId) {
    store.set(seedUserId, {
      source: seedSource,
      equity: seedEquity,
      lastSyncedAt: seedSyncedAt,
    });
  }

  return {
    async getEquity(userId) {
      const snapshot = store.get(userId);
      if (!snapshot) {
        return null;
      }
      return {
        source: snapshot.source,
        equity: snapshot.equity,
        lastSyncedAt: snapshot.lastSyncedAt,
      };
    },
    async setManualEquity(userId, equity) {
      const updated: EquitySnapshot = {
        source: 'manual',
        equity,
        lastSyncedAt: new Date().toISOString(),
      };
      store.set(userId, updated);
      return updated;
    },
  };
};
