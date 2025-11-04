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

const randomDeviceId = () => {
  return `device-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

export interface AuthState {
  deviceId: string;
  token: string | null;
  userId: string | null;
  tokenExpiresAt: string | null;
  setCredentials: (credentials: {
    token: string;
    userId: string;
    deviceId: string;
    tokenExpiresAt: string;
  }) => void;
  ensureDeviceId: () => string;
  clear: () => void;
}

const INITIAL_STATE: Omit<AuthState, 'setCredentials' | 'ensureDeviceId' | 'clear'> = {
  deviceId: randomDeviceId(),
  token: null,
  userId: null,
  tokenExpiresAt: null,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,
      setCredentials: ({ token, userId, deviceId, tokenExpiresAt }) => {
        set({
          token,
          userId,
          deviceId,
          tokenExpiresAt,
        });
      },
      ensureDeviceId: () => {
        const current = get().deviceId;
        if (current) {
          return current;
        }
        const generated = randomDeviceId();
        set({ deviceId: generated });
        return generated;
      },
      clear: () => {
        set({
          token: null,
          userId: null,
          tokenExpiresAt: null,
          deviceId: randomDeviceId(),
        });
      },
    }),
    {
      name: 'tradebill-auth',
      storage: persistStorage,
      version: 1,
      migrate: async (persistedState, version) => {
        if (!persistedState || version === 1) {
          return persistedState as AuthState;
        }

        const safeState = persistedState as Partial<AuthState> | undefined;
        return {
          ...INITIAL_STATE,
          ...safeState,
          deviceId: safeState?.deviceId ?? randomDeviceId(),
        } satisfies AuthState;
      },
    },
  ),
);
