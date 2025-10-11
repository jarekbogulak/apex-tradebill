import { createSettingsService } from '../settingsService.js';
import { createMarketMetadataService } from '../../markets/marketMetadataService.js';
import { createInMemoryUserSettingsRepository } from '../../../domain/user-settings/user-settings.entity.js';

describe('Settings service', () => {
  const PRIMARY_USER_ID = '66666666-6666-6666-6666-666666666666';
  const SECONDARY_USER_ID = '77777777-7777-7777-7777-777777777777';

  test('returns defaults when settings are absent', async () => {
    const repository = createInMemoryUserSettingsRepository();
    const metadata = createMarketMetadataService();
    const service = createSettingsService({ repository, metadata });

    const settings = await service.get(PRIMARY_USER_ID);
    expect(settings.userId).toBe(PRIMARY_USER_ID);
    expect(settings.defaultSymbol).toBeDefined();
  });

  test('updates settings with allowlisted symbol', async () => {
    const repository = createInMemoryUserSettingsRepository();
    const metadata = createMarketMetadataService();
    const service = createSettingsService({ repository, metadata });

    await service.update(SECONDARY_USER_ID, {
      defaultSymbol: 'BTC-USDT',
      riskPercent: 0.03,
      rememberedMultiplierOptions: [1, 2, 2],
    });

    const updated = await service.get(SECONDARY_USER_ID);
    expect(updated.riskPercent).toBe(0.03);
    expect(updated.rememberedMultiplierOptions).toEqual([1, 1.5, 2]);
  });
});
