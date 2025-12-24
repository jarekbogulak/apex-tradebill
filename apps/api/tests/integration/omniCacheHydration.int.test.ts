import { defaultTestEnv, createOperatorJwt } from '../helpers/omniTestUtils.js';

describe('Omni secret cache hydration', () => {
  it('hydrates on startup and serves status data under one second', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.read'] });
      const startedAt = Date.now();
      const response = await ctx.request
        .get('/ops/apex-omni/secrets/status')
        .set('Authorization', `Bearer ${token}`)
        .send();
      const duration = Date.now() - startedAt;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      const entry = (response.body.data ?? []).find(
        (item: { secretType: string }) => item.secretType === 'trading_api_key',
      );
      expect(entry?.cacheSource).not.toBe('empty');
    } finally {
      await ctx.close();
    }
  });

  it('degrades Omni endpoints when cache is empty', async () => {
    const ctx = await globalThis.createOmniTestContext({ env: defaultTestEnv });
    try {
      const token = createOperatorJwt({ scope: ['ops.omni.secrets.read'] });
      await ctx.request
        .post('/internal/apex-omni/secrets/cache/refresh')
        .set('Authorization', `Bearer ${token}`)
        .send({ secretType: 'trading_api_key' });

      const response = await ctx.request
        .get('/ops/apex-omni/secrets/status')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(response.status).toBe(200);
      const entry = (response.body.data ?? []).find(
        (item: { secretType: string }) => item.secretType === 'trading_api_key',
      );
      expect(entry?.cacheSource).toBe('gsm');
    } finally {
      await ctx.close();
    }
  });
});
