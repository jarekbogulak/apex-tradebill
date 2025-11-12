import type { MarketMetadataPort } from '../../ports/tradebillPorts.js';
import {
  createInMemoryUserSettingsRepository,
  createUserSettings,
} from '../../user-settings/user-settings.entity.js';
import { makeGetUserSettings, makeUpdateUserSettings } from '../settings.usecases.js';

const USER_ID = '77777777-7777-7777-7777-777777777777';

const buildMetadata = (overrides: Partial<MarketMetadataPort> = {}): MarketMetadataPort => {
  const defaults: MarketMetadataPort = {
    async getMetadata(symbol) {
      if (symbol === 'BTC-USDT') {
        return {
          symbol,
          tickSize: '0.01',
          stepSize: '0.0001',
          minNotional: '10.00',
          minQuantity: '0.001',
          status: 'tradable',
          displayName: 'BTC/USDT',
        };
      }
      return null;
    },
    async listAllowlistedSymbols() {
      return ['BTC-USDT'];
    },
  };

  return {
    ...defaults,
    ...overrides,
  };
};

describe('Settings use cases', () => {
  test('creates default settings when none exist', async () => {
    const repo = createInMemoryUserSettingsRepository();
    const metadata = buildMetadata();
    const getUserSettings = makeGetUserSettings({ repository: repo, metadata });

    const settings = await getUserSettings(USER_ID);
    expect(settings.defaultSymbol).toBe('BTC-USDT');
    expect(settings.riskPercent).toBeGreaterThan(0);

    const persisted = await repo.findByUserId(USER_ID);
    expect(persisted?.userId).toBe(USER_ID);
  });

  test('updates settings and validates symbols', async () => {
    const baseline = createUserSettings({ userId: USER_ID, defaultSymbol: 'BTC-USDT' });
    const repo = createInMemoryUserSettingsRepository([baseline]);
    const metadata = buildMetadata({
      async getMetadata(symbol) {
        if (symbol === 'ETH-USDT') {
          return {
            symbol,
            tickSize: '0.01',
            stepSize: '0.0001',
            minNotional: '10.00',
            minQuantity: '0.001',
            status: 'tradable',
            displayName: 'ETH/USDT',
          };
        }
        return null;
      },
      async listAllowlistedSymbols() {
        return ['ETH-USDT'];
      },
    });

    const updateSettings = makeUpdateUserSettings({ repository: repo, metadata });
    const updated = await updateSettings(USER_ID, {
      defaultSymbol: 'ETH-USDT',
      riskPercent: 0.05,
    });

    expect(updated.defaultSymbol).toBe('ETH-USDT');
    expect(updated.riskPercent).toBe(0.05);

    await expect(updateSettings(USER_ID, { defaultSymbol: 'DOGE-USDT' })).rejects.toThrow(
      /not allowlisted/,
    );
  });
});
