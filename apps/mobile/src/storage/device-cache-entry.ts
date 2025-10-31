import type { TradeCalculation, TradeInput, TradeOutput } from '@apex-tradebill/types';

interface SQLiteBatchStatement {
  sql: string;
  args: unknown[];
}

interface SQLiteDatabase {
  getAll?: (sql: string, params?: unknown[]) => Record<string, unknown>[];
  exec?: (statements: SQLiteBatchStatement[]) => void;
}

interface SQLiteModule {
  openDatabase(name: string): SQLiteDatabase;
  openDatabaseSync?: (name: string) => SQLiteDatabase;
}

let sqlite: SQLiteModule | null = null;

try {
  sqlite = require('expo-sqlite');
} catch {
  sqlite = null;
}

const DATABASE_NAME = 'tradebill-device-cache.db';
const TABLE_NAME = 'device_cache';
const MAX_ENTRIES = 20;

let database: SQLiteDatabase | null = null;

const openDatabase = () => {
  if (!sqlite) {
    return null;
  }

  if (!database) {
    if (sqlite.openDatabaseSync) {
      database = sqlite.openDatabaseSync(DATABASE_NAME);
    } else {
      database = sqlite.openDatabase(DATABASE_NAME);
    }
  }

  return database;
};

export interface DeviceCacheEntry {
  id: string;
  input: TradeInput;
  output: TradeOutput;
  createdAt: string;
  syncedAt: string | null;
  dirty: boolean;
}

const inMemoryStore: DeviceCacheEntry[] = [];

const ensureTable = () => {
  const db = openDatabase();
  if (!db) {
    return;
  }

  db.exec?.([
    {
      sql: `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id TEXT PRIMARY KEY NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        dirty INTEGER NOT NULL
      );`,
      args: [],
    },
  ]);
};

export const initializeDeviceCache = async (): Promise<void> => {
  ensureTable();
};

export const saveDeviceCacheEntry = async (entry: DeviceCacheEntry): Promise<void> => {
  const normalizedEntry: DeviceCacheEntry = {
    ...entry,
    output: {
      ...entry.output,
      atr13: entry.output.atr13 ?? '0.00000000',
    },
  };

  const db = openDatabase();
  if (!db) {
    inMemoryStore.unshift(normalizedEntry);
    if (inMemoryStore.length > MAX_ENTRIES) {
      inMemoryStore.length = MAX_ENTRIES;
    }
    return;
  }

  ensureTable();

  db.exec?.([
    {
      sql: `INSERT OR REPLACE INTO ${TABLE_NAME} (id, input, output, created_at, synced_at, dirty)
        VALUES (?, ?, ?, ?, ?, ?);`,
      args: [
        normalizedEntry.id,
        JSON.stringify(normalizedEntry.input),
        JSON.stringify(normalizedEntry.output),
        normalizedEntry.createdAt,
        normalizedEntry.syncedAt,
        normalizedEntry.dirty ? 1 : 0,
      ],
    },
    {
      sql: `DELETE FROM ${TABLE_NAME} WHERE id NOT IN (
        SELECT id FROM ${TABLE_NAME} ORDER BY datetime(created_at) DESC LIMIT ${MAX_ENTRIES}
      );`,
      args: [],
    },
  ]);
};

const mapRowToEntry = (row: Record<string, unknown>): DeviceCacheEntry => {
  const input = JSON.parse(String(row.input)) as TradeInput;
  const rawOutput = JSON.parse(String(row.output)) as TradeOutput & {
    atr13?: string;
  };

  const output: TradeOutput = {
    ...rawOutput,
    atr13: rawOutput.atr13 ?? '0.00000000',
  };

  return {
    id: String(row.id),
    input,
    output,
    createdAt: String(row.created_at),
    syncedAt: (row.synced_at as string | null) ?? null,
    dirty: Boolean(row.dirty),
  };
};

export const listDeviceCacheEntries = async (limit = MAX_ENTRIES): Promise<DeviceCacheEntry[]> => {
  const db = openDatabase();
  if (!db) {
    return inMemoryStore.slice(0, limit);
  }

  ensureTable();

  const result = db.getAll?.(
    `SELECT id, input, output, created_at, synced_at, dirty FROM ${TABLE_NAME}
     ORDER BY datetime(created_at) DESC LIMIT ?`,
    [limit],
  );

  if (!result) {
    return [];
  }

  return result.map(mapRowToEntry);
};

export const markDeviceCacheEntrySynced = async (id: string, syncedAt: string): Promise<void> => {
  const db = openDatabase();
  if (!db) {
    const index = inMemoryStore.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      inMemoryStore[index] = {
        ...inMemoryStore[index],
        syncedAt,
        dirty: false,
      };
    }
    return;
  }

  ensureTable();

  db.exec?.([
    {
      sql: `UPDATE ${TABLE_NAME} SET synced_at = ?, dirty = 0 WHERE id = ?;`,
      args: [syncedAt, id],
    },
  ]);
};

export const removeDeviceCacheEntry = async (id: string): Promise<void> => {
  const db = openDatabase();
  if (!db) {
    const index = inMemoryStore.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      inMemoryStore.splice(index, 1);
    }
    return;
  }

  ensureTable();
  db.exec?.([
    {
      sql: `DELETE FROM ${TABLE_NAME} WHERE id = ?;`,
      args: [id],
    },
  ]);
};

export const toTradeCalculation = (entry: DeviceCacheEntry): TradeCalculation => ({
  id: entry.id,
  userId: 'local-device',
  input: entry.input,
  output: entry.output,
  marketSnapshot: {
    symbol: entry.input.symbol,
    lastPrice: entry.input.entryPrice ?? entry.output.positionCost,
    bid: null,
    ask: null,
    atr13: '0.00000000',
    atrMultiplier: entry.input.atrMultiplier,
    stale: true,
    source: 'manual',
    serverTimestamp: entry.createdAt,
  },
  source: entry.input.accountEquitySource === 'manual' ? 'manual' : 'live',
  createdAt: entry.createdAt,
});
