import type { TradeCalculation, TradeInput, TradeOutput } from '@apex-tradebill/types';

type SQLiteModule = typeof import('expo-sqlite');

let sqlite: SQLiteModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sqlite = require('expo-sqlite');
} catch {
  sqlite = null;
}

const DATABASE_NAME = 'tradebill-device-cache.db';
const TABLE_NAME = 'device_cache';
const MAX_ENTRIES = 20;

let database: ReturnType<SQLiteModule['openDatabaseSync']> | null = null;

const openDatabase = () => {
  if (!sqlite) {
    return null;
  }

  if (!database) {
    const open = (sqlite.openDatabaseSync ?? sqlite.openDatabase) as (
      name: string,
    ) => ReturnType<SQLiteModule['openDatabaseSync']>;
    database = open(DATABASE_NAME);
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
  const db = openDatabase();
  if (!db) {
    inMemoryStore.unshift(entry);
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
        entry.id,
        JSON.stringify(entry.input),
        JSON.stringify(entry.output),
        entry.createdAt,
        entry.syncedAt,
        entry.dirty ? 1 : 0,
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

const mapRowToEntry = (row: Record<string, unknown>): DeviceCacheEntry => ({
  id: String(row.id),
  input: JSON.parse(String(row.input)) as TradeInput,
  output: JSON.parse(String(row.output)) as TradeOutput,
  createdAt: String(row.created_at),
  syncedAt: (row.synced_at as string | null) ?? null,
  dirty: Boolean(row.dirty),
});

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
