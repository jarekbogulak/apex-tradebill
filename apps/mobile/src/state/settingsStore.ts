import type { Timeframe } from '@apex-tradebill/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SecureStoreModule {
  getItemAsync(name: string): Promise<string | null>;
  setItemAsync(name: string, value: string): Promise<void>;
  deleteItemAsync(name: string): Promise<void>;
}

let secureStore: SecureStoreModule | null = null;

try {
  secureStore = require('expo-secure-store');
} catch {
  secureStore = null;
}

const memoryStorage = new Map<string, string>();

const persistStorage = createJSONStorage(() => ({
  getItem: async (name: string) => {
    if (secureStore) {
      return secureStore.getItemAsync(name);
    }
    return memoryStorage.get(name) ?? null;
  },
  setItem: async (name: string, value: string) => {
    if (secureStore) {
      await secureStore.setItemAsync(name, value);
      return;
    }
    memoryStorage.set(name, value);
  },
  removeItem: async (name: string) => {
    if (secureStore) {
      await secureStore.deleteItemAsync(name);
      return;
    }
    memoryStorage.delete(name);
  },
}));

const DEFAULT_SYMBOL = 'BTC-USDT';
const DEFAULT_TIMEFRAME: Timeframe = '15m';

const dedupeOptions = (values: string[]): string[] => {
  return Array.from(new Set(values)).sort((a, b) => Number(a) - Number(b));
};

export interface SettingsState {
  riskPercent: string;
  atrMultiplier: string;
  dataFreshnessThresholdMs: number;
  defaultSymbol: string;
  defaultTimeframe: Timeframe;
  rememberedMultiplierOptions: string[];
  lastSyncedAt: string | null;
  setSettings: (
    settings: Partial<Omit<SettingsState, 'setSettings' | 'addMultiplierOption' | 'reset'>>,
  ) => void;
  addMultiplierOption: (value: string) => void;
  reset: () => void;
}

const INITIAL_STATE: Omit<SettingsState, 'setSettings' | 'addMultiplierOption' | 'reset'> = {
  riskPercent: '0.02',
  atrMultiplier: '1.50',
  dataFreshnessThresholdMs: 2000,
  defaultSymbol: DEFAULT_SYMBOL,
  defaultTimeframe: DEFAULT_TIMEFRAME,
  rememberedMultiplierOptions: ['1.00', '1.50', '2.00'],
  lastSyncedAt: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      setSettings: (settings) => {
        set((state) => ({
          ...state,
          ...settings,
          rememberedMultiplierOptions: settings.rememberedMultiplierOptions
            ? dedupeOptions(settings.rememberedMultiplierOptions)
            : state.rememberedMultiplierOptions,
        }));
      },
      addMultiplierOption: (value) => {
        set((state) => ({
          ...state,
          rememberedMultiplierOptions: dedupeOptions([...state.rememberedMultiplierOptions, value]),
        }));
      },
      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: 'tradebill-settings',
      storage: persistStorage,
      version: 1,
      migrate: async (persistedState, version) => {
        if (!persistedState || version === 1) {
          return persistedState as SettingsState;
        }
        return {
          ...INITIAL_STATE,
          ...(persistedState as object),
        } as SettingsState;
      },
    },
  ),
);

export const selectRiskConfig = (state: SettingsState) =>
  state.riskPercent + ':' + state.atrMultiplier;

export const selectFreshnessThreshold = (state: SettingsState) => state.dataFreshnessThresholdMs;

export const selectMultiplierOptions = (state: SettingsState) => state.rememberedMultiplierOptions;
