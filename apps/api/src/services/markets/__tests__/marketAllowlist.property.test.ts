import { createMarketMetadataService } from '../marketMetadataService.js';

describe('ApeX symbol allowlist', () => {
  test('accepts only configured symbols from allowlist configuration', async () => {
    const service = createMarketMetadataService();
    const symbols = await service.listAllowlistedSymbols();

    expect(symbols).toContain('BTC-USDT');
    expect(symbols).toContain('ETH-USDT');

    const metadata = await service.getMetadata('BTC-USDT');
    expect(metadata?.symbol).toBe('BTC-USDT');

    await expect(
      service.upsertMetadata({
        symbol: 'DOGE-USDT',
        tickSize: '0.01',
        stepSize: '1',
        minNotional: '10',
        minQuantity: '1',
        status: 'tradable',
      }),
    ).rejects.toThrow('allowlisted');
  });

  test('rejects suspended symbols surfaced by exchange metadata', async () => {
    const service = createMarketMetadataService();

    await service.upsertMetadata({
      symbol: 'BTC-USDT',
      tickSize: '0.01',
      stepSize: '0.001',
      minNotional: '10',
      minQuantity: '0.001',
      status: 'suspended',
      displayName: 'BTC/USDT',
    });

    const metadata = await service.getMetadata('BTC-USDT');
    expect(metadata?.status).toBe('suspended');
  });
});
