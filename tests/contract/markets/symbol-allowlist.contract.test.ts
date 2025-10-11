import allowlistConfig from '../../../configs/markets/allowlist.json' assert { type: 'json' };

describe('GET /v1/markets/{symbol} allowlist enforcement', () => {
  test('allowlist contains launch symbols', () => {
    expect(Array.isArray(allowlistConfig.symbols)).toBe(true);
    expect(allowlistConfig.symbols).toContain('BTC-USDT');
    expect(allowlistConfig.symbols).toContain('ETH-USDT');
  });
});
